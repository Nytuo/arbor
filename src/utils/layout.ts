import dagre from "dagre";
import type { Person, Relationship } from "../types";

export interface NodeSize {
  width: number;
  height: number;
}

export type SizeOf = (personId: string) => NodeSize;

export interface LayoutPositions {
  [personId: string]: { x: number; y: number };
}

export interface FamilyLayoutOptions {
  nodesep?: number;
  ranksep?: number;
}

export const computeFamilyLayout = (
  people: Person[],
  relationships: Relationship[],
  sizeOf: SizeOf,
  opts: FamilyLayoutOptions = {},
): LayoutPositions => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: opts.nodesep ?? 150,
    ranksep: opts.ranksep ?? 100,
  });

  for (const p of people) {
    const { width, height } = sizeOf(p.id);
    g.setNode(p.id, { width, height });
  }

  const spouseRels = relationships.filter((r) => r.type === "SPOUSE");
  const parentChildRels = relationships.filter(
    (r) => r.type === "PARENT_CHILD",
  );
  const childrenByParent = new Map<string, Set<string>>();
  for (const r of parentChildRels) {
    let set = childrenByParent.get(r.fromId);
    if (!set) {
      set = new Set();
      childrenByParent.set(r.fromId, set);
    }
    set.add(r.toId);
  }

  const processedParentChild = new Set<string>();
  let familyIdx = 0;

  for (const rel of spouseRels) {
    const p1 = rel.fromId;
    const p2 = rel.toId;
    if (!g.hasNode(p1) || !g.hasNode(p2)) continue;

    const c1 = childrenByParent.get(p1);
    const c2 = childrenByParent.get(p2);
    const common: string[] = [];
    if (c1 && c2) {
      const [small, big] = c1.size <= c2.size ? [c1, c2] : [c2, c1];
      for (const id of small) if (big.has(id)) common.push(id);
    }

    if (common.length > 0) {
      const familyNodeId = `family-${familyIdx++}`;
      g.setNode(familyNodeId, { width: 10, height: 10 });
      g.setEdge(p1, familyNodeId);
      g.setEdge(p2, familyNodeId);
      for (const childId of common) {
        if (!g.hasNode(childId)) continue;
        g.setEdge(familyNodeId, childId);
        processedParentChild.add(`${p1}|${childId}`);
        processedParentChild.add(`${p2}|${childId}`);
      }
    } else {
      g.setEdge(p1, p2);
    }
  }

  for (const rel of parentChildRels) {
    if (processedParentChild.has(`${rel.fromId}|${rel.toId}`)) continue;
    if (!g.hasNode(rel.fromId) || !g.hasNode(rel.toId)) continue;
    g.setEdge(rel.fromId, rel.toId);
  }

  dagre.layout(g);

  const result: LayoutPositions = {};
  for (const p of people) {
    const node = g.node(p.id);
    if (!node) continue;
    const { width, height } = sizeOf(p.id);
    result[p.id] = { x: Math.round(node.x - width / 2), y: Math.round(node.y - height / 2) };
  }
  return result;
};
