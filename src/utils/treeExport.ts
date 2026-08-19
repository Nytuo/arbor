import jsPDF from "jspdf";
import type { Person, Relationship } from "../types";
import { computeFamilyLayout } from "./layout";
import { dataUrlMimeType } from "./imageUtils";

export type EdgeKind = "spouse" | "parent";

export interface LogicalEdge {
  id: string;
  kind: EdgeKind;
  sourceId: string;
  targetId: string;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RoutedEdge {
  kind: EdgeKind;
  color: string;
  segments: Segment[];
  arrows?: { x: number; y: number }[];
}

export type Translator = (key: string) => string;

export type PaperFormat = "a4" | "letter" | "a3";
export type Orientation = "auto" | "portrait" | "landscape";
export type PageLayout = "single" | "multi";

export interface ExportOptions {
  format: PaperFormat;
  orientation: Orientation;
  layout: PageLayout;
  margin: number;
  includeTitle: boolean;
  includeIndex: boolean;
  transparentBackground?: boolean;
  includeTileIndicator?: boolean;
  title: string;
  subtitle?: string;
  t: Translator;
}

const SPOUSE_COLOR = "#10b981";
const PARENT_COLOR = "#64748b";
const BG_COLOR = "#f8fafc";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#cbd5e1";
const TEXT_PRIMARY = "#0f172a";
const TEXT_SECONDARY = "#475569";
const TEXT_MUTED = "#94a3b8";
const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

const genderAccent = (g?: Person["gender"]): string => {
  switch (g) {
    case "M":
      return "#3b82f6";
    case "F":
      return "#ec4899";
    case "O":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
};

const getYear = (d?: string): string => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d.slice(0, 4);
  return String(dt.getFullYear());
};

const lifeSpan = (p: Person): string => {
  const b = getYear(p.birthDate);
  const dth = getYear(p.deathDate);
  if (!b && !dth) return "";
  return `${b || "?"} – ${dth || ""}`.trim().replace(/–\s*$/, "– …").trim();
};

const titleCaseName = (s: string): string =>
  s.toLocaleLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase());

export const formatPersonName = (p: Pick<Person, "firstName" | "lastName">): string => {
  const first = (p.firstName || "").trim();
  const last = (p.lastName || "").trim();
  return `${first ? titleCaseName(first) : ""} ${last ? last.toLocaleUpperCase() : ""}`.trim();
};

export const fullName = (p: Person, t: Translator): string => formatPersonName(p) || t("unknown");

const escapeXml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c] || c,
  );

export const buildLogicalEdges = (
  people: Person[],
  relationships: Relationship[],
): LogicalEdge[] => {
  if (people.length === 0) return [];

  const personIds = new Set(people.map((p) => p.id));
  const childrenByParent = new Map<string, Set<string>>();
  const spouseRels: Relationship[] = [];
  const parentChildRels: Relationship[] = [];

  for (const r of relationships) {
    if (!personIds.has(r.fromId) || !personIds.has(r.toId)) continue;
    if (r.type === "SPOUSE") {
      spouseRels.push(r);
    } else if (r.type === "PARENT_CHILD") {
      parentChildRels.push(r);
      let set = childrenByParent.get(r.fromId);
      if (!set) {
        set = new Set();
        childrenByParent.set(r.fromId, set);
      }
      set.add(r.toId);
    }
  }

  const edges: LogicalEdge[] = [];
  const addedEdgeIds = new Set<string>();
  const processedParentChild = new Set<string>();

  for (const rel of spouseRels) {
    const p1 = rel.fromId;
    const p2 = rel.toId;
    const coupleKey = p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
    const spouseId = `s-${coupleKey}`;
    if (!addedEdgeIds.has(spouseId)) {
      addedEdgeIds.add(spouseId);
      edges.push({ id: spouseId, kind: "spouse", sourceId: p1, targetId: p2 });
    }

    const c1 = childrenByParent.get(p1);
    const c2 = childrenByParent.get(p2);
    if (!c1 || !c2) continue;
    const [small, big] = c1.size <= c2.size ? [c1, c2] : [c2, c1];
    for (const childId of small) {
      if (!big.has(childId)) continue;
      for (const parentId of [p1, p2]) {
        const eid = `pc-${parentId}-${childId}`;
        if (addedEdgeIds.has(eid)) continue;
        addedEdgeIds.add(eid);
        edges.push({
          id: eid,
          kind: "parent",
          sourceId: parentId,
          targetId: childId,
        });
        processedParentChild.add(`${parentId}|${childId}`);
      }
    }
  }

  for (const rel of parentChildRels) {
    const key = `${rel.fromId}|${rel.toId}`;
    if (processedParentChild.has(key)) continue;
    const eid = `pc-${rel.fromId}-${rel.toId}`;
    if (addedEdgeIds.has(eid)) continue;
    addedEdgeIds.add(eid);
    edges.push({
      id: eid,
      kind: "parent",
      sourceId: rel.fromId,
      targetId: rel.toId,
    });
  }

  return edges;
};

const CARD_BASE_WIDTH = 240;
const CARD_PADDING = 16;
const AVATAR_SIZE = 56;
const AVATAR_GAP = 12;
const TEXT_X = CARD_PADDING + AVATAR_SIZE + AVATAR_GAP;
const NAME_SIZE = 14;
const SUB_SIZE = 11;
const NOTE_SIZE = 11;
const LINE_GAP = 1.25;

interface CardTextLine {
  x: number;
  y: number;
  width: number;
  text: string;
  size: number;
  weight: "bold" | "normal";
  italic?: boolean;
  color: string;
}

export interface CardLayout {
  width: number;
  height: number;
  accent: string;
  photo?: string;
  lines: CardTextLine[];
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
const getMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (measureCtx !== undefined) return measureCtx;
  try {
    measureCtx = document.createElement("canvas").getContext("2d");
  } catch {
    measureCtx = null;
  }
  return measureCtx;
};

const fontString = (size: number, weight: "bold" | "normal", italic?: boolean) =>
  `${italic ? "italic " : ""}${weight} ${size}px ${FONT_FAMILY}`;

const measureWidth = (text: string, size: number, weight: "bold" | "normal", italic?: boolean): number => {
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * size * 0.55;
  ctx.font = fontString(size, weight, italic);
  return ctx.measureText(text).width;
};

const wrapText = (
  text: string,
  maxWidth: number,
  size: number,
  weight: "bold" | "normal",
  italic?: boolean,
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";

  const pushHardBroken = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      const candidate = chunk + ch;
      if (measureWidth(candidate, size, weight, italic) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureWidth(candidate, size, weight, italic) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (measureWidth(word, size, weight, italic) > maxWidth) {
      current = pushHardBroken(word);
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

interface WrappedRun {
  text: string;
  size: number;
  weight: "bold" | "normal";
  italic?: boolean;
  color: string;
}

const lineH = (size: number) => size * (1 + LINE_GAP * 0.15) + 2;

export const computeCardLayout = (p: Person, t: Translator): CardLayout => {
  const accent = genderAccent(p.gender);
  const name = fullName(p, t);
  const maiden = p.maidenName ? `${t("maidenPrefix")} ${p.maidenName}` : "";
  const life = lifeSpan(p);
  const notesRaw = (p.notes || "").trim();

  let textWidth = CARD_BASE_WIDTH - TEXT_X - CARD_PADDING;

  const build = (width: number): WrappedRun[] => {
    const runs: WrappedRun[] = [];
    for (const l of wrapText(name, width, NAME_SIZE, "bold")) {
      runs.push({ text: l, size: NAME_SIZE, weight: "bold", color: TEXT_PRIMARY });
    }
    if (maiden) {
      for (const l of wrapText(maiden, width, SUB_SIZE, "normal", true)) {
        runs.push({ text: l, size: SUB_SIZE, weight: "normal", italic: true, color: TEXT_SECONDARY });
      }
    }
    if (life) {
      for (const l of wrapText(life, width, SUB_SIZE, "bold")) {
        runs.push({ text: l, size: SUB_SIZE, weight: "bold", color: TEXT_SECONDARY });
      }
    }
    if (notesRaw) {
      for (const para of notesRaw.split(/\r?\n/)) {
        for (const l of wrapText(para, width, NOTE_SIZE, "normal")) {
          runs.push({ text: l, size: NOTE_SIZE, weight: "normal", color: TEXT_MUTED });
        }
      }
    }
    return runs;
  };

  let header = build(textWidth);
  const maxMeasured = header.reduce(
    (m, run) => Math.max(m, measureWidth(run.text, run.size, run.weight, run.italic)),
    0,
  );

  if (maxMeasured > textWidth) {
    textWidth = Math.ceil(maxMeasured);
    header = build(textWidth);
  }

  const cardWidth = TEXT_X + textWidth + CARD_PADDING;
  const bodyWidth = cardWidth - CARD_PADDING * 2;

  const lines: CardTextLine[] = [];
  let y = CARD_PADDING + NAME_SIZE;
  let sawNotes = false;
  let lastBaseline = y;
  let lastSize = NAME_SIZE;

  for (const run of header) {
    const isNote = run.color === TEXT_MUTED && run.size === NOTE_SIZE;
    if (isNote && !sawNotes) {
      sawNotes = true;
      y = Math.max(y, CARD_PADDING + AVATAR_SIZE) + 6;
    }
    const x = isNote ? CARD_PADDING : TEXT_X;
    const width = isNote ? bodyWidth : textWidth;
    lines.push({ x, y, width, text: run.text, size: run.size, weight: run.weight, italic: run.italic, color: run.color });
    lastBaseline = y;
    lastSize = run.size;
    y += lineH(run.size);
  }

  const textBottom = lastBaseline + lastSize * 0.3 + CARD_PADDING;
  const avatarBottom = CARD_PADDING + AVATAR_SIZE + CARD_PADDING;
  const height = Math.ceil(Math.max(textBottom, avatarBottom));

  return {
    width: Math.ceil(cardWidth),
    height,
    accent,
    photo: p.photo,
    lines,
  };
};

export interface ExportNode {
  id: string;
  x: number;
  y: number;
  person: Person;
  layout: CardLayout;
}

export const layoutExportNodes = (
  people: Person[],
  relationships: Relationship[],
  t: Translator,
): ExportNode[] => {
  const layouts = new Map<string, CardLayout>();
  for (const p of people) layouts.set(p.id, computeCardLayout(p, t));

  const positions = computeFamilyLayout(
    people,
    relationships,
    (id) => {
      const l = layouts.get(id);
      return l ? { width: l.width, height: l.height } : { width: CARD_BASE_WIDTH, height: 80 };
    },
    { nodesep: 60, ranksep: 90 },
  );

  return people.map((p) => {
    const pos = positions[p.id] ?? { x: 0, y: 0 };
    return { id: p.id, x: pos.x, y: pos.y, person: p, layout: layouts.get(p.id)! };
  });
};

const routeEdges = (nodes: ExportNode[], edges: LogicalEdge[]): RoutedEdge[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: RoutedEdge[] = [];

  const parentChildEdges = edges.filter((e) => e.kind === "parent");
  const childrenByParent = new Map<string, Set<string>>();
  for (const e of parentChildEdges) {
    let set = childrenByParent.get(e.sourceId);
    if (!set) {
      set = new Set();
      childrenByParent.set(e.sourceId, set);
    }
    set.add(e.targetId);
  }

  const busedParentChild = new Set<string>();

  for (const e of edges) {
    if (e.kind !== "spouse") continue;
    const s = byId.get(e.sourceId);
    const t = byId.get(e.targetId);
    if (!s || !t) continue;
    const c1 = childrenByParent.get(e.sourceId);
    const c2 = childrenByParent.get(e.targetId);
    if (!c1 || !c2) continue;
    const shared = [...c1].filter((id) => c2.has(id));
    if (shared.length === 0) continue;

    const sx = s.x + s.layout.width;
    const sy = s.y + s.layout.height / 2;
    const tx = t.x;
    const ty = t.y + t.layout.height / 2;
    const busX = (sx + tx) / 2;
    const busY = (sy + ty) / 2;

    const childNodes = shared.map((id) => byId.get(id)).filter((n): n is ExportNode => !!n);
    if (childNodes.length === 0) continue;
    const childTop = Math.min(...childNodes.map((n) => n.y));
    const barY = (busY + childTop) / 2;
    const childXs = childNodes.map((n) => n.x + n.layout.width / 2);
    const barX1 = Math.min(busX, ...childXs);
    const barX2 = Math.max(busX, ...childXs);

    const segments: Segment[] = [
      { x1: busX, y1: busY, x2: busX, y2: barY },
      { x1: barX1, y1: barY, x2: barX2, y2: barY },
    ];
    const arrows: { x: number; y: number }[] = [];
    for (const child of childNodes) {
      const cx = child.x + child.layout.width / 2;
      segments.push({ x1: cx, y1: barY, x2: cx, y2: child.y });
      arrows.push({ x: cx, y: child.y });
      busedParentChild.add(`${e.sourceId}|${child.id}`);
      busedParentChild.add(`${e.targetId}|${child.id}`);
    }
    out.push({ kind: "parent", color: PARENT_COLOR, segments, arrows });
  }

  for (const e of edges) {
    const s = byId.get(e.sourceId);
    const t = byId.get(e.targetId);
    if (!s || !t) continue;
    if (e.kind === "spouse") {
      const sx = s.x + s.layout.width;
      const sy = s.y + s.layout.height / 2;
      const tx = t.x;
      const ty = t.y + t.layout.height / 2;
      if (Math.abs(sy - ty) < 2) {
        out.push({
          kind: "spouse",
          color: SPOUSE_COLOR,
          segments: [{ x1: sx, y1: sy, x2: tx, y2: ty }],
        });
      } else {
        const midX = (sx + tx) / 2;
        out.push({
          kind: "spouse",
          color: SPOUSE_COLOR,
          segments: [
            { x1: sx, y1: sy, x2: midX, y2: sy },
            { x1: midX, y1: sy, x2: midX, y2: ty },
            { x1: midX, y1: ty, x2: tx, y2: ty },
          ],
        });
      }
    } else {
      if (busedParentChild.has(`${e.sourceId}|${e.targetId}`)) continue;
      const sx = s.x + s.layout.width / 2;
      const sy = s.y + s.layout.height;
      const tx = t.x + t.layout.width / 2;
      const ty = t.y;
      const midY = (sy + ty) / 2;
      out.push({
        kind: "parent",
        color: PARENT_COLOR,
        segments: [
          { x1: sx, y1: sy, x2: sx, y2: midY },
          { x1: sx, y1: midY, x2: tx, y2: midY },
          { x1: tx, y1: midY, x2: tx, y2: ty },
        ],
        arrows: [{ x: tx, y: ty }],
      });
    }
  }
  return out;
};

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const computeBounds = (nodes: ExportNode[]): Bounds => {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.layout.width > maxX) maxX = n.x + n.layout.width;
    if (n.y + n.layout.height > maxY) maxY = n.y + n.layout.height;
  }
  return { minX, minY, maxX, maxY };
};

const nodeSvgParts = (n: ExportNode): string => {
  const { layout } = n;
  const w = layout.width;
  const h = layout.height;
  const avatarRadius = 12;

  const parts: string[] = [];
  parts.push(`<g transform="translate(${n.x},${n.y})">`);
  parts.push(
    `<rect width="${w}" height="${h}" rx="12" ry="12" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
  );
  parts.push(
    `<rect width="4" height="${h}" rx="2" ry="2" fill="${layout.accent}"/>`,
  );

  if (layout.photo) {
    const clipId = `avatar-clip-${n.id}`;
    parts.push(
      `<clipPath id="${clipId}"><rect x="${CARD_PADDING}" y="${CARD_PADDING}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" rx="${avatarRadius}" ry="${avatarRadius}"/></clipPath>`,
    );
    parts.push(
      `<image href="${layout.photo}" x="${CARD_PADDING}" y="${CARD_PADDING}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`,
    );
    parts.push(
      `<rect x="${CARD_PADDING}" y="${CARD_PADDING}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" rx="${avatarRadius}" ry="${avatarRadius}" fill="none" stroke="${CARD_BORDER}" stroke-width="2"/>`,
    );
  } else {
    parts.push(
      `<rect x="${CARD_PADDING}" y="${CARD_PADDING}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" rx="${avatarRadius}" ry="${avatarRadius}" fill="${layout.accent}" fill-opacity="0.15" stroke="${layout.accent}" stroke-opacity="0.3" stroke-width="2"/>`,
    );
    const iconSize = AVATAR_SIZE * 0.4;
    const iconOffset = CARD_PADDING + (AVATAR_SIZE - iconSize) / 2;
    parts.push(
      `<rect x="${iconOffset}" y="${iconOffset}" width="${iconSize}" height="${iconSize}" rx="${iconSize * 0.3}" ry="${iconSize * 0.3}" fill="${layout.accent}"/>`,
    );
  }

  for (const line of layout.lines) {
    const weight = line.weight === "bold" ? ` font-weight="700"` : "";
    const style = line.italic ? ` font-style="italic"` : "";
    parts.push(
      `<text x="${line.x}" y="${line.y}" font-size="${line.size}"${weight}${style} fill="${line.color}">${escapeXml(line.text)}</text>`,
    );
  }

  parts.push(`</g>`);
  return parts.join("");
};

const segmentsToPath = (segments: Segment[]): string => {
  let d = "";
  let prev: { x: number; y: number } | null = null;
  for (const s of segments) {
    if (!prev || prev.x !== s.x1 || prev.y !== s.y1) d += `M ${s.x1} ${s.y1} `;
    d += `L ${s.x2} ${s.y2} `;
    prev = { x: s.x2, y: s.y2 };
  }
  return d.trim();
};

const edgeSvgParts = (e: RoutedEdge): string => {
  if (e.segments.length === 0) return "";
  const strokeWidth = e.kind === "spouse" ? 2 : 1.6;
  const d = segmentsToPath(e.segments);
  let out = `<path d="${d}" fill="none" stroke="${e.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  for (const { x, y } of e.arrows ?? []) {
    const sz = 6;
    out += `<path d="M ${x - sz} ${y - sz} L ${x} ${y} L ${x + sz} ${y - sz} Z" fill="${e.color}"/>`;
  }
  return out;
};

export const buildTreeSvg = (
  nodes: ExportNode[],
  logicalEdges: LogicalEdge[],
  _t: Translator,
  opts?: { title?: string; subtitle?: string },
): string => {
  const padding = 40;
  const { minX, minY, maxX, maxY } = computeBounds(nodes);
  const titleHeight = opts?.title ? 60 : 0;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2 + titleHeight);
  const vbX = minX - padding;
  const vbY = minY - padding - titleHeight;

  const routed = routeEdges(nodes, logicalEdges);

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vbX} ${vbY} ${width} ${height}" font-family="${FONT_FAMILY}">`,
  );
  parts.push(
    `<rect x="${vbX}" y="${vbY}" width="${width}" height="${height}" fill="${BG_COLOR}"/>`,
  );

  if (opts?.title) {
    parts.push(
      `<text x="${vbX + padding}" y="${vbY + 32}" font-size="22" font-weight="700" fill="${TEXT_PRIMARY}">${escapeXml(opts.title)}</text>`,
    );
    if (opts.subtitle) {
      parts.push(
        `<text x="${vbX + padding}" y="${vbY + 52}" font-size="12" fill="${TEXT_SECONDARY}">${escapeXml(opts.subtitle)}</text>`,
      );
    }
  }

  for (const e of routed) parts.push(edgeSvgParts(e));
  for (const n of nodes) parts.push(nodeSvgParts(n));

  parts.push("</svg>");
  return parts.join("");
};

const PAGE_SIZES_PT: Record<PaperFormat, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  a3: [841.89, 1190.55],
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const expanded =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(expanded, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const intersects = (a: PageRect, b: PageRect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const applyDraw = (pdf: jsPDF, hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  pdf.setDrawColor(r, g, b);
};
const applyFill = (pdf: jsPDF, hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  pdf.setFillColor(r, g, b);
};
const applyText = (pdf: jsPDF, hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  pdf.setTextColor(r, g, b);
};

const pdfImageFormat = (dataUrl: string): "PNG" | "JPEG" => {
  const mime = dataUrlMimeType(dataUrl);
  return mime.includes("png") ? "PNG" : "JPEG";
};

const drawNodePdf = (
  pdf: jsPDF,
  n: ExportNode,
  offsetX: number,
  offsetY: number,
  scale: number,
) => {
  const { layout } = n;
  const x = (n.x - offsetX) * scale;
  const y = (n.y - offsetY) * scale;
  const w = layout.width * scale;
  const h = layout.height * scale;

  applyDraw(pdf, CARD_BORDER);
  applyFill(pdf, CARD_BG);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(x, y, w, h, 6 * scale, 6 * scale, "FD");

  applyFill(pdf, layout.accent);
  pdf.roundedRect(x, y, 3 * scale, h, 1.5 * scale, 1.5 * scale, "F");

  const avatarSize = AVATAR_SIZE * scale;
  const avatarX = x + CARD_PADDING * scale;
  const avatarY = y + CARD_PADDING * scale;
  const avatarRadius = 6 * scale;

  if (layout.photo) {
    try {
      pdf.saveGraphicsState();
      const clipPath = pdf as unknown as {
        roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string) => void;
        clip: () => void;
        discardPath: () => void;
      };
      clipPath.roundedRect(avatarX, avatarY, avatarSize, avatarSize, avatarRadius, avatarRadius);
      clipPath.clip();
      clipPath.discardPath();
      pdf.addImage(layout.photo, pdfImageFormat(layout.photo), avatarX, avatarY, avatarSize, avatarSize);
      pdf.restoreGraphicsState();
      applyDraw(pdf, CARD_BORDER);
      pdf.setLineWidth(0.6 * scale);
      pdf.roundedRect(avatarX, avatarY, avatarSize, avatarSize, avatarRadius, avatarRadius, "D");
    } catch {
      // Fall through silently: a corrupt/unsupported image should not abort the export.
    }
  } else {
    applyFill(pdf, layout.accent);
    pdf.roundedRect(avatarX, avatarY, avatarSize, avatarSize, avatarRadius, avatarRadius, "F");
  }

  for (const line of layout.lines) {
    pdf.setFont("helvetica", line.italic ? "italic" : line.weight === "bold" ? "bold" : "normal");
    pdf.setFontSize(line.size * scale);
    applyText(pdf, line.color);
    pdf.text(line.text, x + line.x * scale, y + line.y * scale);
  }
};

const drawEdgePdf = (
  pdf: jsPDF,
  e: RoutedEdge,
  offsetX: number,
  offsetY: number,
  scale: number,
) => {
  pdf.setDrawColor(...hexToRgb(e.color));
  pdf.setLineWidth(e.kind === "spouse" ? 0.8 : 0.6);
  for (const s of e.segments) {
    pdf.line(
      (s.x1 - offsetX) * scale,
      (s.y1 - offsetY) * scale,
      (s.x2 - offsetX) * scale,
      (s.y2 - offsetY) * scale,
    );
  }
  for (const arrow of e.arrows ?? []) {
    const size = 4 * scale;
    const ax = (arrow.x - offsetX) * scale;
    const ay = (arrow.y - offsetY) * scale;
    pdf.setFillColor(...hexToRgb(e.color));
    pdf.triangle(ax - size, ay - size, ax + size, ay - size, ax, ay, "F");
  }
};

const pageRectForNode = (n: ExportNode): PageRect => ({
  x: n.x,
  y: n.y,
  w: n.layout.width,
  h: n.layout.height,
});

const pageRectForEdge = (e: RoutedEdge): PageRect => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of e.segments) {
    minX = Math.min(minX, s.x1, s.x2);
    minY = Math.min(minY, s.y1, s.y2);
    maxX = Math.max(maxX, s.x1, s.x2);
    maxY = Math.max(maxY, s.y1, s.y2);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

const resolveOrientation = (
  opts: ExportOptions,
  diagramW: number,
  diagramH: number,
): "portrait" | "landscape" => {
  if (opts.orientation !== "auto") return opts.orientation;
  return diagramW > diagramH ? "landscape" : "portrait";
};

const computeScale = (
  layout: PageLayout,
  contentW: number,
  contentH: number,
  diagramW: number,
  diagramH: number,
): number => {
  if (layout !== "single") return 0.6;
  const fit = Math.min(contentW / diagramW, contentH / diagramH);
  if (!Number.isFinite(fit) || fit <= 0) return 1;
  return Math.min(fit, 1);
};

interface PageLayoutMetrics {
  orientation: "portrait" | "landscape";
  pageW: number;
  pageH: number;
  contentW: number;
  contentH: number;
  titleReserve: number;
  scale: number;
  tileW: number;
  tileH: number;
  cols: number;
  rows: number;
}

const computePageMetrics = (
  opts: ExportOptions,
  diagramW: number,
  diagramH: number,
): PageLayoutMetrics => {
  const [pw, ph] = PAGE_SIZES_PT[opts.format];
  const orientation = resolveOrientation(opts, diagramW, diagramH);
  const [pageW, pageH] = orientation === "landscape" ? [ph, pw] : [pw, ph];
  const titleReserve = opts.includeTitle ? 40 : 0;
  const contentW = pageW - opts.margin * 2;
  const contentH = pageH - opts.margin * 2 - titleReserve;
  const scale = computeScale(
    opts.layout,
    contentW,
    contentH,
    diagramW,
    diagramH,
  );
  const tileW = contentW / scale;
  const tileH = contentH / scale;
  const cols = Math.max(1, Math.ceil(diagramW / tileW));
  const rows = Math.max(1, Math.ceil(diagramH / tileH));
  return {
    orientation,
    pageW,
    pageH,
    contentW,
    contentH,
    titleReserve,
    scale,
    tileW,
    tileH,
    cols,
    rows,
  };
};

const drawPdfTitle = (
  pdf: jsPDF,
  opts: ExportOptions,
  metrics: PageLayoutMetrics,
  page: number,
  totalPages: number,
) => {
  if (!opts.includeTitle) return;
  const { pageW } = metrics;
  applyText(pdf, TEXT_PRIMARY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(opts.title || "", opts.margin, opts.margin + 14);
  if (opts.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    applyText(pdf, TEXT_SECONDARY);
    pdf.text(opts.subtitle, opts.margin, opts.margin + 28);
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  applyText(pdf, TEXT_MUTED);
  pdf.text(`${page} / ${totalPages}`, pageW - opts.margin, opts.margin + 14, {
    align: "right",
  });
};

const drawTileIndicator = (pdf: jsPDF, metrics: PageLayoutMetrics, row: number, col: number) => {
  const { pageW } = metrics;
  const inset = 8;
  const label = `(${col + 1}, ${row + 1})`;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const padX = 4;
  const padY = 3;
  const textW = pdf.getTextWidth(label);
  const boxW = textW + padX * 2;
  const boxH = 8 + padY * 2;
  const x = pageW - inset - boxW;
  const y = inset;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, boxW, boxH, 2, 2, "FD");
  applyText(pdf, TEXT_SECONDARY);
  pdf.text(label, x + padX, y + boxH - padY - 1);
};

const drawCropMarks = (
  pdf: jsPDF,
  opts: ExportOptions,
  metrics: PageLayoutMetrics,
) => {
  if (opts.layout !== "multi" || opts.margin <= 0) return;
  const { pageW, pageH, titleReserve } = metrics;
  const m = opts.margin;
  pdf.setDrawColor(150, 150, 150);
  pdf.setLineWidth(0.3);
  const len = 6;
  const top = m + titleReserve;
  pdf.line(m - len, top, m, top);
  pdf.line(m, top - len, m, top);
  pdf.line(pageW - m, top, pageW - m + len, top);
  pdf.line(pageW - m, top - len, pageW - m, top);
  pdf.line(m - len, pageH - m, m, pageH - m);
  pdf.line(m, pageH - m, m, pageH - m + len);
  pdf.line(pageW - m, pageH - m, pageW - m + len, pageH - m);
  pdf.line(pageW - m, pageH - m, pageW - m, pageH - m + len);
};

interface TileContext {
  bounds: Bounds;
  nodeRects: { n: ExportNode; r: PageRect }[];
  edgeRects: { e: RoutedEdge; r: PageRect }[];
}

const drawTile = (
  pdf: jsPDF,
  opts: ExportOptions,
  metrics: PageLayoutMetrics,
  ctx: TileContext,
  row: number,
  col: number,
) => {
  const { bounds, nodeRects, edgeRects } = ctx;
  const { pageW, pageH, titleReserve, scale, tileW, tileH } = metrics;
  const m = opts.margin;

  if (!opts.transparentBackground) {
    applyFill(pdf, BG_COLOR);
    pdf.rect(
      m,
      m + titleReserve,
      pageW - m * 2,
      pageH - m * 2 - titleReserve,
      "F",
    );
  }

  const offsetX = bounds.minX + col * tileW;
  const offsetY = bounds.minY + row * tileH;
  const viewportRect: PageRect = { x: offsetX, y: offsetY, w: tileW, h: tileH };
  const translateOriginX = offsetX - m / scale;
  const translateOriginY = offsetY - (m + titleReserve) / scale;

  pdf.saveGraphicsState();
  pdf.rect(m, m + titleReserve, pageW - m * 2, pageH - m * 2 - titleReserve);
  (pdf as unknown as { clip: () => void; discardPath: () => void }).clip();
  (
    pdf as unknown as { clip: () => void; discardPath: () => void }
  ).discardPath();

  for (const { e, r } of edgeRects) {
    if (!intersects(r, viewportRect)) continue;
    drawEdgePdf(pdf, e, translateOriginX, translateOriginY, scale);
  }
  for (const { n, r } of nodeRects) {
    if (!intersects(r, viewportRect)) continue;
    drawNodePdf(pdf, n, translateOriginX, translateOriginY, scale);
  }

  pdf.restoreGraphicsState();
};

const truncate = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

const drawIndex = (
  pdf: jsPDF,
  opts: ExportOptions,
  metrics: PageLayoutMetrics,
  nodes: ExportNode[],
): number => {
  const { pageW, pageH, orientation } = metrics;
  const m = opts.margin;

  pdf.addPage([pageW, pageH], orientation);
  let extraPages = 1;

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageW, pageH, "F");

  applyText(pdf, TEXT_PRIMARY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(opts.t("personIndex"), m, m + 20);

  const sorted = [...nodes].sort((a, b) =>
    fullName(a.person, opts.t).localeCompare(fullName(b.person, opts.t)),
  );

  const colCount = orientation === "landscape" ? 3 : 2;
  const colWidth = (pageW - m * 2 - (colCount - 1) * 12) / colCount;
  const lineHeight = 12;
  const startY = m + 44;
  const maxLinesPerCol = Math.floor((pageH - m - startY) / lineHeight);
  let col = 0;
  let line = 0;

  for (const n of sorted) {
    const label = (() => {
      const name = fullName(n.person, opts.t);
      const life = lifeSpan(n.person);
      return life ? `${name}  (${life})` : name;
    })();
    const x = m + col * (colWidth + 12);
    const y = startY + line * lineHeight;
    applyText(pdf, TEXT_PRIMARY);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(truncate(label, Math.floor(colWidth / 4.5)), x, y);
    line++;
    if (line < maxLinesPerCol) continue;
    line = 0;
    col++;
    if (col < colCount) continue;
    pdf.addPage([pageW, pageH], orientation);
    extraPages++;
    col = 0;
  }

  return extraPages;
};

export const buildTreePdf = (
  nodes: ExportNode[],
  logicalEdges: LogicalEdge[],
  opts: ExportOptions,
): jsPDF => {
  const bounds = computeBounds(nodes);
  const diagramW = bounds.maxX - bounds.minX;
  const diagramH = bounds.maxY - bounds.minY;
  const metrics = computePageMetrics(opts, diagramW, diagramH);

  const pdf = new jsPDF({
    unit: "pt",
    orientation: metrics.orientation,
    format: [metrics.pageW, metrics.pageH],
  });
  const routed = routeEdges(nodes, logicalEdges);
  const nodeRects = nodes.map((n) => ({ n, r: pageRectForNode(n) }));
  const edgeRects = routed.map((e) => ({ e, r: pageRectForEdge(e) }));

  const tilesToRender: { row: number; col: number }[] = [];
  for (let row = 0; row < metrics.rows; row++) {
    for (let col = 0; col < metrics.cols; col++) {
      const viewportRect: PageRect = {
        x: bounds.minX + col * metrics.tileW,
        y: bounds.minY + row * metrics.tileH,
        w: metrics.tileW,
        h: metrics.tileH,
      };
      if (nodeRects.some(({ r }) => intersects(r, viewportRect))) tilesToRender.push({ row, col });
    }
  }
  if (tilesToRender.length === 0) tilesToRender.push({ row: 0, col: 0 });

  const estIndexPages = opts.includeIndex ? 1 : 0;
  const totalPages = tilesToRender.length + estIndexPages;

  let pageCount = 0;
  for (const { row, col } of tilesToRender) {
    if (pageCount > 0) pdf.addPage([metrics.pageW, metrics.pageH], metrics.orientation);
    pageCount++;
    drawTile(pdf, opts, metrics, { bounds, nodeRects, edgeRects }, row, col);
    drawPdfTitle(pdf, opts, metrics, pageCount, totalPages);
    drawCropMarks(pdf, opts, metrics);
    if (opts.includeTileIndicator !== false && opts.layout === "multi" && tilesToRender.length > 1) {
      drawTileIndicator(pdf, metrics, row, col);
    }
  }

  if (opts.includeIndex) {
    drawIndex(pdf, opts, metrics, nodes);
  }

  return pdf;
};
