#!/usr/bin/env node
/**
 * Generates two JSON fixtures matching Arbor's FamilyTreeData shape
 * ({ people, relationships, groups }), importable straight from the header's
 * Import button:
 *
 *   - data/perf_test_<count>.json  — a wide/deep synthetic tree for perf testing
 *     (auto-arrange, canvas pan/zoom, SVG/PDF export) with realistic
 *     generation-by-generation SPOUSE/PARENT_CHILD structure.
 *   - data/feature_test.json       — a small hand-curated tree exercising every
 *     card feature: photos, extra images, maiden names, long/unbroken text
 *     (wrapping), missing dates, groups, all genders.
 *
 * Usage: node scripts/generate_test_fixtures.cjs [perfCount]
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const uuid = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Minimal dependency-free PNG encoder (solid color square) for embedding
// realistic base64 photo/extraImages payloads without any image library.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};
const solidPng = (size, [r, g, b]) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
};

const PALETTE = [
  [239, 68, 68], // red
  [59, 130, 246], // blue
  [16, 185, 129], // emerald
  [245, 158, 11], // amber
  [139, 92, 246], // violet
  [236, 72, 153], // pink
];
const swatch = (i, size = 96) => solidPng(size, PALETTE[i % PALETTE.length]);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const FIRST_NAMES_M = ["James", "Robert", "John", "Michael", "William", "David", "Richard", "Thomas", "Henri", "Louis", "Jean", "Marc", "Paul", "Andre", "Pierre"];
const FIRST_NAMES_F = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Marie", "Claire", "Sophie", "Anne", "Julie", "Camille", "Louise"];
const SURNAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Dubois", "Martin", "Bernard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre"];
const PLACES = ["Paris, France", "Lyon, France", "Boston, USA", "New York, USA", "London, UK", "Berlin, Germany", "Madrid, Spain", "Rome, Italy", "Montreal, Canada"];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (year) => `${year}-${pad2(randInt(1, 12))}-${pad2(randInt(1, 28))}`;

const makePerson = (gender, birthYear, opts = {}) => {
  const firstName = gender === "F" ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
  const lastName = opts.lastName || pick(SURNAMES);
  const dies = Math.random() > 0.35;
  const deathYear = dies ? Math.min(birthYear + randInt(40, 92), new Date().getFullYear()) : undefined;
  return {
    id: uuid(),
    firstName,
    lastName,
    maidenName: gender === "F" && opts.maidenName ? opts.maidenName : undefined,
    gender,
    birthDate: isoDate(birthYear),
    birthPlace: pick(PLACES),
    deathDate: deathYear ? isoDate(deathYear) : undefined,
    deathPlace: deathYear ? pick(PLACES) : undefined,
    notes: opts.notes,
    position: opts.position,
  };
};

// ---------------------------------------------------------------------------
// 1) Big performance fixture: generation-by-generation tree with realistic
//    SPOUSE + PARENT_CHILD relationships (shared-children detection in
//    buildLogicalEdges relies on this shape, same as real user data).
// ---------------------------------------------------------------------------
const generatePerfTree = (targetCount) => {
  const people = [];
  const relationships = [];
  const addRel = (type, fromId, toId) =>
    relationships.push({ id: uuid(), type, fromId, toId, ...(type === "SPOUSE" ? { metadata: { status: "married" } } : {}) });

  const ROW_H = 220;
  const COL_W = 260;
  let generation = 0;
  let currentGenCouples = []; // { husband, wife, lastName, xCenter }

  const founders = Math.max(4, Math.round(targetCount / 400));
  for (let i = 0; i < founders; i++) {
    const lastName = pick(SURNAMES);
    const birthYear = randInt(1780, 1820);
    const husband = makePerson("M", birthYear, { lastName, position: { x: i * COL_W * 3, y: generation * ROW_H } });
    const wife = makePerson("F", birthYear + randInt(-3, 3), { lastName, maidenName: pick(SURNAMES), position: { x: i * COL_W * 3 + COL_W, y: generation * ROW_H } });
    people.push(husband, wife);
    addRel("SPOUSE", husband.id, wife.id);
    currentGenCouples.push({ husband, wife, lastName, xCenter: i * COL_W * 3 + COL_W / 2, birthYear });
  }

  while (people.length < targetCount && currentGenCouples.length > 0) {
    generation++;
    const nextGenCouples = [];
    let xCursor = 0;

    for (const couple of currentGenCouples) {
      if (people.length >= targetCount) break;
      const childCount = randInt(1, 4);
      const childYearBase = couple.birthYear + randInt(20, 35);
      const childXStart = xCursor;

      for (let c = 0; c < childCount; c++) {
        if (people.length >= targetCount) break;
        const childGender = Math.random() > 0.5 ? "M" : "F";
        const childBirthYear = childYearBase + randInt(0, 6);
        const child = makePerson(childGender, childBirthYear, {
          lastName: couple.lastName,
          position: { x: xCursor, y: generation * ROW_H },
        });
        people.push(child);
        addRel("PARENT_CHILD", couple.husband.id, child.id);
        addRel("PARENT_CHILD", couple.wife.id, child.id);

        // ~65% of children marry in and continue the tree to the next generation.
        if (Math.random() < 0.65 && people.length < targetCount) {
          const spouseGender = childGender === "M" ? "F" : "M";
          const inLawLastName = childGender === "F" ? couple.lastName : pick(SURNAMES);
          const spouse = makePerson(spouseGender, childBirthYear + randInt(-3, 3), {
            lastName: inLawLastName,
            maidenName: spouseGender === "F" ? pick(SURNAMES) : undefined,
            position: { x: xCursor + COL_W, y: generation * ROW_H },
          });
          people.push(spouse);
          addRel("SPOUSE", child.id, spouse.id);
          const husband = childGender === "M" ? child : spouse;
          const wife = childGender === "M" ? spouse : child;
          nextGenCouples.push({ husband, wife, lastName: couple.lastName, xCenter: xCursor + COL_W / 2, birthYear: childBirthYear });
          xCursor += COL_W * 2.4;
        } else {
          xCursor += COL_W * 1.2;
        }
      }
      xCursor = Math.max(xCursor, childXStart + COL_W * 2.4);
    }

    currentGenCouples = nextGenCouples;
  }

  return { people, relationships, groups: [] };
};

// ---------------------------------------------------------------------------
// 2) Small feature fixture: exercises every card/export/photo feature at
//    once so it's fast to eyeball after import.
// ---------------------------------------------------------------------------
const generateFeatureTree = () => {
  const people = [];
  const relationships = [];
  const groups = [];
  const addRel = (type, fromId, toId, metadata) =>
    relationships.push({ id: uuid(), type, fromId, toId, ...(metadata ? { metadata } : {}) });

  // Grandparents — long note to test paragraph wrapping without truncation.
  const grandpa = {
    id: uuid(),
    firstName: "Jean-Baptiste",
    lastName: "de Montmorency-Bouteville",
    gender: "M",
    birthDate: "1932-03-14",
    birthPlace: "Bordeaux, France",
    deathDate: "2011-09-02",
    deathPlace: "Bordeaux, France",
    notes:
      "Served as a merchant navy captain for over thirty years before retiring to run the family vineyard. Kept meticulous diaries of every voyage, later donated to the regional maritime museum. Loved chess, disliked being photographed, and always wore his grandfather's pocket watch.",
    photo: swatch(0, 128),
    extraImages: [
      { id: uuid(), dataUrl: swatch(0, 480) },
      { id: uuid(), dataUrl: swatch(1, 480) },
    ],
    position: { x: 0, y: 0 },
  };
  const grandma = {
    id: uuid(),
    firstName: "Marguerite",
    lastName: "de Montmorency-Bouteville",
    maidenName: "Vasconcelos-Rothschild",
    gender: "F",
    birthDate: "1935-07-22",
    birthPlace: "Porto, Portugal",
    deathDate: "2018-01-30",
    deathPlace: "Bordeaux, France",
    notes: "Classically trained pianist. Taught music at the village school for forty-one years.",
    photo: swatch(1, 128),
    position: { x: 260, y: 0 },
  };
  people.push(grandpa, grandma);
  addRel("SPOUSE", grandpa.id, grandma.id, { status: "married", date: "1958-06-10" });

  // Parents generation — one with a very long unbroken surname (hard-break test),
  // one minimal record (unknown gender, no dates, tests "Unknown"/"present" fallback).
  const father = {
    id: uuid(),
    firstName: "Alexandre",
    lastName: "Wojciechowski-Papadopoulos-Nakagawa",
    gender: "M",
    birthDate: "1959-11-05",
    birthPlace: "Bordeaux, France",
    notes: "Runs the family vineyard today.",
    position: { x: 0, y: 220 },
  };
  const mother = {
    id: uuid(),
    firstName: "Isabelle",
    lastName: "Wojciechowski-Papadopoulos-Nakagawa",
    maidenName: "Chevallier",
    gender: "F",
    birthDate: "1962-02-18",
    birthPlace: "Lyon, France",
    photo: swatch(2, 128),
    position: { x: 260, y: 220 },
  };
  const unknownRelative = {
    id: uuid(),
    firstName: "",
    lastName: "",
    gender: "U",
    position: { x: 600, y: 220 },
  };
  people.push(father, mother, unknownRelative);
  addRel("PARENT_CHILD", grandpa.id, father.id);
  addRel("PARENT_CHILD", grandma.id, father.id);
  addRel("SPOUSE", father.id, mother.id, { status: "married", date: "1985-05-20" });

  // Children generation — includes an "other" gender card and a step-relationship.
  const childA = {
    id: uuid(),
    firstName: "Camille",
    lastName: "Wojciechowski-Papadopoulos-Nakagawa",
    gender: "F",
    birthDate: "1988-04-09",
    birthPlace: "Bordeaux, France",
    notes: "Sommelier. Lives in Bordeaux.",
    position: { x: 0, y: 440 },
  };
  const childB = {
    id: uuid(),
    firstName: "Remy",
    lastName: "Wojciechowski-Papadopoulos-Nakagawa",
    gender: "O",
    birthDate: "1991-12-25",
    birthPlace: "Bordeaux, France",
    position: { x: 260, y: 440 },
  };
  people.push(childA, childB);
  addRel("PARENT_CHILD", father.id, childA.id);
  addRel("PARENT_CHILD", mother.id, childA.id);
  addRel("PARENT_CHILD", father.id, childB.id);
  addRel("PARENT_CHILD", mother.id, childB.id);
  addRel("PARENT_CHILD", unknownRelative.id, childB.id, { relationshipType: "step" });

  groups.push(
    {
      id: uuid(),
      label: "Verify: photos & long text",
      color: "amber",
      position: { x: -60, y: -80 },
      size: { width: 620, height: 340 },
    },
    {
      id: uuid(),
      label: "Verify: missing data fallbacks",
      color: "sky",
      position: { x: -60, y: 380 },
      size: { width: 620, height: 260 },
    },
  );

  return { people, relationships, groups };
};

// ---------------------------------------------------------------------------
const perfCount = parseInt(process.argv[2], 10) || 5000;

const perfData = generatePerfTree(perfCount);
const perfPath = path.join(dataDir, `perf_test_${perfData.people.length}.json`);
fs.writeFileSync(perfPath, JSON.stringify(perfData, null, 2));
console.log(
  `Perf fixture: ${perfPath} (${perfData.people.length} people, ${perfData.relationships.length} relationships)`,
);

const featureData = generateFeatureTree();
const featurePath = path.join(dataDir, "feature_test.json");
fs.writeFileSync(featurePath, JSON.stringify(featureData, null, 2));
console.log(
  `Feature fixture: ${featurePath} (${featureData.people.length} people, ${featureData.relationships.length} relationships, ${featureData.groups.length} groups)`,
);
