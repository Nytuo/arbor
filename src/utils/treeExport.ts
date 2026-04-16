import jsPDF from "jspdf";
import type { Person, Relationship } from "../types";

export const EXPORT_NODE_W = 200;
export const EXPORT_NODE_H = 80;

export interface ExportNode {
  id: string;
  x: number;
  y: number;
  person: Person;
}

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
  arrow?: { x: number; y: number };
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

export const fullName = (p: Person, t: Translator): string => {
  const n = `${p.firstName || ""} ${p.lastName || ""}`.trim();
  return n || t("unknown");
};

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

/**
 * O(N + R) computation of logical edges to render.
 * Produces one spouse edge per couple and parent-child edges with shared-child deduplication.
 */
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

const routeEdges = (
  nodes: ExportNode[],
  edges: LogicalEdge[],
): RoutedEdge[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: RoutedEdge[] = [];
  for (const e of edges) {
    const s = byId.get(e.sourceId);
    const t = byId.get(e.targetId);
    if (!s || !t) continue;
    if (e.kind === "spouse") {
      const sx = s.x + EXPORT_NODE_W;
      const sy = s.y + EXPORT_NODE_H / 2;
      const tx = t.x;
      const ty = t.y + EXPORT_NODE_H / 2;
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
      const sx = s.x + EXPORT_NODE_W / 2;
      const sy = s.y + EXPORT_NODE_H;
      const tx = t.x + EXPORT_NODE_W / 2;
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
        arrow: { x: tx, y: ty },
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
    if (n.x + EXPORT_NODE_W > maxX) maxX = n.x + EXPORT_NODE_W;
    if (n.y + EXPORT_NODE_H > maxY) maxY = n.y + EXPORT_NODE_H;
  }
  return { minX, minY, maxX, maxY };
};

const nodeSvgParts = (n: ExportNode, t: Translator): string => {
  const p = n.person;
  const accent = genderAccent(p.gender);
  const name = fullName(p, t);
  const life = lifeSpan(p);
  const maiden = p.maidenName ? `${t("maidenPrefix")} ${p.maidenName}` : "";
  const notesRaw = (p.notes || "").split(/\r?\n/)[0] || "";
  const notes = notesRaw.length > 42 ? notesRaw.slice(0, 39) + "…" : notesRaw;

  const parts: string[] = [];
  parts.push(`<g transform="translate(${n.x},${n.y})">`);
  parts.push(
    `<rect width="${EXPORT_NODE_W}" height="${EXPORT_NODE_H}" rx="12" ry="12" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
  );
  parts.push(
    `<rect width="4" height="${EXPORT_NODE_H}" rx="2" ry="2" fill="${accent}"/>`,
  );
  parts.push(
    `<circle cx="24" cy="26" r="11" fill="${accent}" fill-opacity="0.15"/>`,
  );
  parts.push(`<circle cx="24" cy="26" r="5" fill="${accent}"/>`);
  parts.push(
    `<text x="44" y="24" font-size="13" font-weight="700" fill="${TEXT_PRIMARY}">${escapeXml(name)}</text>`,
  );
  let y = 40;
  if (maiden) {
    parts.push(
      `<text x="44" y="${y}" font-size="10" fill="${TEXT_SECONDARY}" font-style="italic">${escapeXml(maiden)}</text>`,
    );
    y += 14;
  }
  if (life) {
    parts.push(
      `<text x="44" y="${y}" font-size="10" font-weight="600" fill="${TEXT_SECONDARY}">${escapeXml(life)}</text>`,
    );
    y += 14;
  }
  if (notes) {
    parts.push(
      `<text x="12" y="73" font-size="9" fill="${TEXT_MUTED}">${escapeXml(notes)}</text>`,
    );
  }
  parts.push(`</g>`);
  return parts.join("");
};

const edgeSvgParts = (e: RoutedEdge): string => {
  const first = e.segments[0];
  if (!first) return "";
  const strokeWidth = e.kind === "spouse" ? 2 : 1.6;
  let d = `M ${first.x1} ${first.y1}`;
  for (const s of e.segments) d += ` L ${s.x2} ${s.y2}`;
  let out = `<path d="${d}" fill="none" stroke="${e.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (e.arrow) {
    const sz = 6;
    const { x, y } = e.arrow;
    out += `<path d="M ${x - sz} ${y - sz} L ${x} ${y} L ${x + sz} ${y - sz} Z" fill="${e.color}"/>`;
  }
  return out;
};

export const buildTreeSvg = (
  nodes: ExportNode[],
  logicalEdges: LogicalEdge[],
  t: Translator,
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vbX} ${vbY} ${width} ${height}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif">`,
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
  for (const n of nodes) parts.push(nodeSvgParts(n, t));

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

const drawNodePdf = (
  pdf: jsPDF,
  n: ExportNode,
  t: Translator,
  offsetX: number,
  offsetY: number,
  scale: number,
) => {
  const p = n.person;
  const x = (n.x - offsetX) * scale;
  const y = (n.y - offsetY) * scale;
  const w = EXPORT_NODE_W * scale;
  const h = EXPORT_NODE_H * scale;
  const accent = genderAccent(p.gender);

  applyDraw(pdf, CARD_BORDER);
  applyFill(pdf, CARD_BG);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(x, y, w, h, 6 * scale, 6 * scale, "FD");

  applyFill(pdf, accent);
  pdf.roundedRect(x, y, 3 * scale, h, 1.5 * scale, 1.5 * scale, "F");

  pdf.circle(x + 12 * scale, y + 13 * scale, 2.5 * scale, "F");

  const textX = x + 22 * scale;
  applyText(pdf, TEXT_PRIMARY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10 * scale);
  const name = fullName(p, t);
  pdf.text(truncate(name, 26), textX, y + 12 * scale);

  let yCursor = y + 20 * scale;
  if (p.maidenName) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7 * scale);
    applyText(pdf, TEXT_SECONDARY);
    pdf.text(
      truncate(`${t("maidenPrefix")} ${p.maidenName}`, 32),
      textX,
      yCursor,
    );
    yCursor += 7 * scale;
  }
  const life = lifeSpan(p);
  if (life) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7 * scale);
    applyText(pdf, TEXT_SECONDARY);
    pdf.text(life, textX, yCursor);
    yCursor += 7 * scale;
  }
  if (p.notes) {
    const note = (p.notes.split(/\r?\n/)[0] || "").trim();
    if (note) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5 * scale);
      applyText(pdf, TEXT_MUTED);
      pdf.text(truncate(note, 40), x + 6 * scale, y + h - 4 * scale);
    }
  }
};

const truncate = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

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
  if (e.arrow) {
    const size = 4 * scale;
    const ax = (e.arrow.x - offsetX) * scale;
    const ay = (e.arrow.y - offsetY) * scale;
    pdf.setFillColor(...hexToRgb(e.color));
    pdf.triangle(ax - size, ay - size, ax + size, ay - size, ax, ay, "F");
  }
};

const pageRectForNode = (n: ExportNode): PageRect => ({
  x: n.x,
  y: n.y,
  w: EXPORT_NODE_W,
  h: EXPORT_NODE_H,
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
  row: number,
  col: number,
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
  const multi = opts.layout === "multi" && totalPages > 1;
  const coord = multi ? `  •  (${col + 1}, ${row + 1})` : "";
  pdf.text(
    `${page} / ${totalPages}${coord}`,
    pageW - opts.margin,
    opts.margin + 14,
    { align: "right" },
  );
};

const drawCropMarks = (
  pdf: jsPDF,
  opts: ExportOptions,
  metrics: PageLayoutMetrics,
) => {
  if (opts.layout !== "multi") return;
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

  applyFill(pdf, BG_COLOR);
  pdf.rect(
    m,
    m + titleReserve,
    pageW - m * 2,
    pageH - m * 2 - titleReserve,
    "F",
  );

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
    drawNodePdf(pdf, n, opts.t, translateOriginX, translateOriginY, scale);
  }

  pdf.restoreGraphicsState();
};

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

  const totalTilePages = metrics.cols * metrics.rows;
  const estIndexPages = opts.includeIndex ? 1 : 0;
  const totalPages = totalTilePages + estIndexPages;

  let pageCount = 0;
  for (let row = 0; row < metrics.rows; row++) {
    for (let col = 0; col < metrics.cols; col++) {
      if (pageCount > 0)
        pdf.addPage([metrics.pageW, metrics.pageH], metrics.orientation);
      pageCount++;
      drawTile(pdf, opts, metrics, { bounds, nodeRects, edgeRects }, row, col);
      drawPdfTitle(pdf, opts, metrics, pageCount, totalPages, row, col);
      drawCropMarks(pdf, opts, metrics);
    }
  }

  if (opts.includeIndex) {
    drawIndex(pdf, opts, metrics, nodes);
  }

  return pdf;
};

export const toPersonNodes = (people: Person[]): ExportNode[] =>
  people.map((p) => ({
    id: p.id,
    x: p.position?.x ?? 0,
    y: p.position?.y ?? 0,
    person: p,
  }));
