#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const count = parseInt(process.argv[2], 10) || 2000;
const outPath =
  process.argv[3] || path.join(__dirname, "..", "data", `complex_${count}.ged`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const stream = fs.createWriteStream(outPath, { encoding: "utf8" });

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad(n) {
  return (n < 10 ? "0" : "") + n;
}
function randomDate(yearFrom, yearTo) {
  const y = randInt(yearFrom, yearTo);
  const m = randInt(1, 12);
  const d = randInt(1, 28);
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${pad(d)} ${months[m - 1]} ${y}`;
}

stream.write("0 HEAD\n");
stream.write("1 SOUR gedcom-generator\n");
stream.write(`1 DATE ${new Date().toISOString()}\n`);
stream.write("1 CHAR UTF-8\n");

const individuals = [];
const families = [];

for (let i = 1; i <= count; i++) {
  const id = `@I${i}@`;
  const sex = i % 2 === 0 ? "F" : "M";
  const given = `Given${i}`;
  const surname = `Surname${Math.ceil(i / 20)}`;
  const name = `${given} /${surname}/`;
  const birthYear = randInt(1600, 2000);
  const birthDate = randomDate(Math.max(1600, birthYear - 2), birthYear);
  const deathRoll = Math.random();
  const deathDate =
    deathRoll > 0.85
      ? randomDate(birthYear + 20, Math.min(birthYear + 100, 2025))
      : null;
  const note = `Auto-generated person ${i}. This record is part of a large synthetic GEDCOM for testing purposes.`;

  individuals.push({ id, name, sex, birthDate, deathDate, note });
}

const spouseCount = Math.floor((count * 0.6) / 2);
let famIdx = 1;
for (let i = 1; i <= spouseCount * 2; i += 2) {
  const husband = `@I${i}@`;
  const wife = `@I${i + 1}@`;
  const famId = `@F${famIdx}@`;
  const marrYear = randInt(1700, 2020);
  const marrDate = randomDate(Math.max(1700, marrYear - 5), marrYear);
  families.push({ id: famId, husband, wife, marrDate, children: [] });
  famIdx++;
}

const firstChildIndex = spouseCount * 2 + 1;
for (let i = firstChildIndex; i <= count; i++) {
  const childId = `@I${i}@`;
  const pick = families[randInt(0, Math.max(0, families.length - 1))];
  if (pick) pick.children.push(childId);
}

for (let k = 0; k < Math.floor(families.length * 0.1); k++) {
  const fam = families[randInt(0, families.length - 1)];
  const childId = `@I${randInt(1, count)}@`;
  if (fam && !fam.children.includes(childId) && Math.random() > 0.7)
    fam.children.push(childId);
}

individuals.forEach((ind) => {
  stream.write(`0 ${ind.id} INDI\n`);
  stream.write(`1 NAME ${ind.name}\n`);
  stream.write(`1 SEX ${ind.sex}\n`);
  stream.write("1 BIRT\n");
  stream.write(`2 DATE ${ind.birthDate}\n`);
  stream.write(`2 PLAC Generated Place, Testland\n`);
  if (ind.deathDate) {
    stream.write("1 DEAT\n");
    stream.write(`2 DATE ${ind.deathDate}\n`);
    stream.write("2 PLAC Generated Place, Testland\n");
  }
  if (Math.random() > 0.5 && families.length > 0)
    stream.write(`1 FAMS @F${randInt(1, families.length)}@\n`);
  if (Math.random() > 0.8 && families.length > 0)
    stream.write(`1 FAMC @F${randInt(1, families.length)}@\n`);
  stream.write(`1 NOTE ${ind.note}\n`);
});

families.forEach((f) => {
  stream.write(`0 ${f.id} FAM\n`);
  stream.write(`1 HUSB ${f.husband}\n`);
  stream.write(`1 WIFE ${f.wife}\n`);
  stream.write("1 MARR\n");
  stream.write(`2 DATE ${f.marrDate}\n`);
  stream.write("2 PLAC Generated Place, Testland\n");
  f.children.forEach((c) => stream.write(`1 CHIL ${c}\n`));
  if (Math.random() > 0.6) stream.write("1 RESN none\n");
});

stream.write("0 TRLR\n");
stream.end(() => {
  console.log("GEDCOM generation complete:", outPath);
});
