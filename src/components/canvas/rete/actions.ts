import { useTreeStore } from "@/store/useTreeStore";
import { computeCardLayout } from "@/utils/treeExport";
import type { Translator } from "@/utils/treeExport";
import { computeFamilyLayout } from "@/utils/layout";
import { areaInstanceRef, editorInstanceRef } from "./area-context";
import { isPersonNode } from "./schema";

const CANVAS_NODE_FALLBACK = { width: 240, height: 90 };
export const DEFAULT_GROUP_WIDTH = 280;
export const DEFAULT_GROUP_HEIGHT = 180;

export const getViewportCenter = (): { x: number; y: number } => {
  const area = areaInstanceRef.current;
  if (!area) return { x: 0, y: 0 };
  const rect = area.container.getBoundingClientRect();
  const { x, y, k } = area.area.transform;
  return {
    x: Math.round((rect.width / 2 - x) / k),
    y: Math.round((rect.height / 2 - y) / k),
  };
};

export const autoArrangeTree = (t: Translator) => {
  const { people, relationships, updatePerson } = useTreeStore.getState();
  const layouts = new Map(people.map((p) => [p.id, computeCardLayout(p, t)]));
  const positions = computeFamilyLayout(
    people,
    relationships,
    (id) => {
      const l = layouts.get(id);
      return l ? { width: l.width, height: l.height } : CANVAS_NODE_FALLBACK;
    },
    { nodesep: 60, ranksep: 90 },
  );
  for (const person of people) {
    const pos = positions[person.id];
    if (pos) updatePerson(person.id, { position: pos });
  }
};

export const addPersonAtViewportCenter = (): string => {
  const { addPerson, updatePerson, setSelectedPersonId } = useTreeStore.getState();
  const id = addPerson({ firstName: "", lastName: "" });
  setSelectedPersonId(id);
  updatePerson(id, { position: getViewportCenter() });
  return id;
};

export const jumpToPerson = (personId: string) => {
  useTreeStore.getState().setSelectedPersonId(personId);
  const area = areaInstanceRef.current;
  const editor = editorInstanceRef.current;
  if (!area || !editor) return;
  const node = editor.getNodes().find((n) => isPersonNode(n) && n.personId === personId);
  if (!node) return;
  const view = area.nodeViews.get(node.id);
  if (!view || !isPersonNode(node)) return;
  const rect = area.container.getBoundingClientRect();
  const { k } = area.area.transform;
  const cx = view.position.x + node.width / 2;
  const cy = view.position.y + node.height / 2;
  void area.area.translate(rect.width / 2 - cx * k, rect.height / 2 - cy * k);
};

const CHILD_OFFSET = { x: 0, y: 220 };
const PARENT_OFFSET = { x: 0, y: -220 };
const SPOUSE_OFFSET = { x: 280, y: 0 };

export const addChildOf = (personId: string, pos?: { x: number; y: number }): string => {
  const store = useTreeStore.getState();
  const parent = store.people.find((p) => p.id === personId);
  const base = parent?.position ?? getViewportCenter();
  const id = store.addPerson({ firstName: "", lastName: "" });
  store.updatePerson(id, { position: pos ?? { x: base.x, y: base.y + CHILD_OFFSET.y } });
  store.addRelationship({ type: "PARENT_CHILD", fromId: personId, toId: id });
  store.setSelectedPersonId(id);
  return id;
};

export const addParentOf = (personId: string, pos?: { x: number; y: number }): string => {
  const store = useTreeStore.getState();
  const child = store.people.find((p) => p.id === personId);
  const base = child?.position ?? getViewportCenter();
  const id = store.addPerson({ firstName: "", lastName: "" });
  store.updatePerson(id, { position: pos ?? { x: base.x, y: base.y + PARENT_OFFSET.y } });
  store.addRelationship({ type: "PARENT_CHILD", fromId: id, toId: personId });
  store.setSelectedPersonId(id);
  return id;
};

export const addSpouseOf = (personId: string, pos?: { x: number; y: number }): string => {
  const store = useTreeStore.getState();
  const person = store.people.find((p) => p.id === personId);
  const base = person?.position ?? getViewportCenter();
  const id = store.addPerson({ firstName: "", lastName: "" });
  store.updatePerson(id, { position: pos ?? { x: base.x + SPOUSE_OFFSET.x, y: base.y } });
  store.addRelationship({ type: "SPOUSE", fromId: personId, toId: id });
  store.setSelectedPersonId(id);
  return id;
};

export const addGroupAtViewportCenter = (t: Translator) => {
  const center = getViewportCenter();
  useTreeStore.getState().addGroup({
    label: t("newGroup"),
    color: "slate",
    position: { x: center.x - DEFAULT_GROUP_WIDTH / 2, y: center.y - DEFAULT_GROUP_HEIGHT / 2 },
    size: { width: DEFAULT_GROUP_WIDTH, height: DEFAULT_GROUP_HEIGHT },
  });
};
