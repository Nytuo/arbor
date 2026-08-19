import { useEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { NodeEditor } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import type { Area2D } from "rete-area-plugin";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { ReactPlugin, Presets as ReactPresets } from "rete-react-plugin";
import { getDOMSocketPosition } from "rete-render-utils";
import { MinimapPlugin } from "rete-minimap-plugin";
import { ContextMenuPlugin } from "rete-context-menu-plugin";
import { useTreeStore } from "@/store/useTreeStore";
import type { Translator } from "@/utils/treeExport";
import { computeCardLayout } from "@/utils/treeExport";
import {
  PersonRete,
  GroupRete,
  RelConnection,
  isPersonNode,
  isGroupNode,
} from "./schema";
import type { Schemes, AreaExtra } from "./schema";
import { areaInstanceRef, editorInstanceRef } from "./area-context";
import { addPersonAtViewportCenter, addGroupAtViewportCenter, addChildOf, addParentOf, addSpouseOf } from "./actions";
import PersonNodeComponent from "../nodes/PersonNodeComponent";
import GroupNodeComponent from "../nodes/GroupNodeComponent";
import ConnectionComponent from "../nodes/ConnectionComponent";
import SocketComponent from "../nodes/SocketComponent";
import ContextMenuComponent from "../nodes/ContextMenuComponent";

export const GRID_SIZE = 20;
export const GEN_ROW_HEIGHT = 160;
const GROUP_PADDING = 24;

export interface Transform {
  x: number;
  y: number;
  k: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const unionRect = (a: Rect, b: Rect): Rect => {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

const rectsEqual = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const VIRTUALIZE_MARGIN = 800;

const getVisibleWorldRect = (area: AreaPlugin<Schemes, AreaExtra>): Rect => {
  const rect = area.container.getBoundingClientRect();
  const { x, y, k } = area.area.transform;
  return {
    x: (-VIRTUALIZE_MARGIN - x) / k,
    y: (-VIRTUALIZE_MARGIN - y) / k,
    width: (rect.width + VIRTUALIZE_MARGIN * 2) / k,
    height: (rect.height + VIRTUALIZE_MARGIN * 2) / k,
  };
};

const setNodeZIndex = (area: AreaPlugin<Schemes, AreaExtra>, nodeId: string, z: string) => {
  const el = area.nodeViews.get(nodeId)?.element;
  if (el) el.style.zIndex = z;
};

export const useTreeEditor = (t: Translator) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<NodeEditor<Schemes> | null>(null);
  const areaRef = useRef<AreaPlugin<Schemes, AreaExtra> | null>(null);
  const [ready, setReady] = useState(false);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const syncSeqRef = useRef(0);
  const genGridRef = useRef(false);
  const personNodeMapRef = useRef(new Map<string, PersonRete>());
  const syncRef = useRef<() => void>(() => {});
  const syncInProgressRef = useRef(false);
  const viewportSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLinkRef = useRef<{ personId: string; socketKey: string; pos: { x: number; y: number } } | null>(null);

  const handlePersonDragEnd = useCallback(
    (personId: string, pos: { x: number; y: number }, translator: Translator) => {
      const store = useTreeStore.getState();
      const person = store.people.find((p) => p.id === personId);
      if (!person) return;
      const layout = computeCardLayout(person, translator);
      const cardRect: Rect = { x: pos.x, y: pos.y, width: layout.width, height: layout.height };
      const cx = cardRect.x + cardRect.width / 2;
      const cy = cardRect.y + cardRect.height / 2;

      const hit = store.groups.find(
        (g) => cx >= g.position.x && cx <= g.position.x + g.size.width && cy >= g.position.y && cy <= g.position.y + g.size.height,
      );

      store.updatePerson(personId, { position: pos, groupId: hit ? hit.id : undefined });

      if (hit) {
        const groupRect: Rect = { x: hit.position.x, y: hit.position.y, width: hit.size.width, height: hit.size.height };
        const padded: Rect = {
          x: cardRect.x - GROUP_PADDING,
          y: cardRect.y - GROUP_PADDING,
          width: cardRect.width + GROUP_PADDING * 2,
          height: cardRect.height + GROUP_PADDING * 2,
        };
        const grown = unionRect(groupRect, padded);
        if (!rectsEqual(grown, groupRect)) {
          store.updateGroup(hit.id, { position: { x: grown.x, y: grown.y }, size: { width: grown.width, height: grown.height } });
        }
      }
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const editor = new NodeEditor<Schemes>();
    const area = new AreaPlugin<Schemes, AreaExtra>(container);
    const connection = new ConnectionPlugin<Schemes, AreaExtra>();
    const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
    const minimap = new MinimapPlugin<Schemes>();

    interface MenuItemsCollection {
      searchBar: boolean;
      list: { key: string; label: string; handler: () => void | Promise<void> }[];
    }
    const contextMenuItems = (context: "root" | Schemes["Node"]): MenuItemsCollection => {
      if (context === "root") {
        const link = pendingLinkRef.current;
        pendingLinkRef.current = null;
        if (link) {
          const list: MenuItemsCollection["list"] = [];
          if (link.socketKey === "child") {
            list.push({ key: "add-child", label: t("addChildCtx"), handler: () => void addChildOf(link.personId, link.pos) });
          } else if (link.socketKey === "parent") {
            list.push({ key: "add-parent", label: t("addParentCtx"), handler: () => void addParentOf(link.personId, link.pos) });
          } else {
            list.push({ key: "add-spouse", label: t("addSpouseCtx"), handler: () => void addSpouseOf(link.personId, link.pos) });
          }
          return { searchBar: false, list };
        }
        return {
          searchBar: false,
          list: [
            { key: "add-person", label: t("addPerson"), handler: () => addPersonAtViewportCenter() },
            { key: "add-group", label: t("addGroup"), handler: () => addGroupAtViewportCenter(t) },
          ],
        };
      }
      if (isPersonNode(context)) {
        const personId = context.personId;
        return {
          searchBar: false,
          list: [
            { key: "add-child", label: t("addChildCtx"), handler: () => addChildOf(personId) },
            { key: "add-spouse", label: t("addSpouseCtx"), handler: () => addSpouseOf(personId) },
            {
              key: "remove",
              label: t("deletePerson"),
              handler: () => {
                if (window.confirm(t("deleteConfirm"))) useTreeStore.getState().deletePerson(personId);
              },
            },
          ],
        };
      }
      if (isGroupNode(context)) {
        const groupId = context.groupId;
        return {
          searchBar: false,
          list: [{ key: "remove-group", label: t("removeGroupCtx"), handler: () => useTreeStore.getState().deleteGroup(groupId) }],
        };
      }
      return { searchBar: false, list: [] };
    };
    const contextMenu = new ContextMenuPlugin<Schemes>({ items: contextMenuItems });

    AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
      accumulating: AreaExtensions.accumulateOnCtrl(),
    });
    AreaExtensions.simpleNodesOrder(area);

    render.addPreset(
      ReactPresets.classic.setup({
        socketPositionWatcher: getDOMSocketPosition({ offset: (position) => position }),
        customize: {
          node(data) {
            return isGroupNode(data.payload) ? GroupNodeComponent : PersonNodeComponent;
          },
          connection() {
            return ConnectionComponent;
          },
          socket() {
            return SocketComponent;
          },
        },
      }),
    );
    render.addPreset(ReactPresets.minimap.setup({ size: 150 }));
    render.addPreset({
      render(context: AreaExtra) {
        if (context.type !== "render" || context.data.type !== "contextmenu") return undefined;
        return <ContextMenuComponent data={context.data} />;
      },
    });
    connection.addPreset(ConnectionPresets.classic.setup());

    connection.addPipe((context) => {
      if (context.type === "connectiondrop") {
        const { initial, socket, created } = context.data;
        if (!created && !socket) {
          const node = editor.getNode(initial.nodeId);
          if (node && isPersonNode(node)) {
            const rect = area.container.getBoundingClientRect();
            const { x, y, k } = area.area.transform;
            const worldPos = area.area.pointer;
            pendingLinkRef.current = { personId: node.personId, socketKey: initial.key, pos: worldPos };
            const syntheticEvent = {
              clientX: rect.left + worldPos.x * k + x,
              clientY: rect.top + worldPos.y * k + y,
              preventDefault: () => {},
              stopPropagation: () => {},
            } as MouseEvent;
            void area.emit({ type: "contextmenu", data: { event: syntheticEvent, context: "root" } });
          }
        }
      }
      return context;
    });

    editor.use(area);
    area.use(connection);
    area.use(contextMenu);
    area.use(render);
    area.use(minimap);

    editor.addPipe((context) => {
      if (context.type === "connectioncreate") {
        const c = context.data;
        const valid =
          (c.sourceOutput === "child" && c.targetInput === "parent") ||
          (c.sourceOutput === "spouseOut" && c.targetInput === "spouseIn");
        if (!valid || c.source === c.target) return undefined;
      }
      if (context.type === "connectioncreated") {
        const c = context.data as Partial<RelConnection> & {
          source: string;
          target: string;
          sourceOutput: string;
          targetInput: string;
        };
        if (!c.relationshipId) {
          const sourceNode = editor.getNode(c.source);
          const targetNode = editor.getNode(c.target);
          if (sourceNode && targetNode && isPersonNode(sourceNode) && isPersonNode(targetNode)) {
            const type = c.sourceOutput === "spouseOut" ? "SPOUSE" : "PARENT_CHILD";
            useTreeStore.getState().addRelationship({
              type,
              fromId: sourceNode.personId,
              toId: targetNode.personId,
            });
          }
        }
      }
      if (context.type === "connectionremoved") {
        const c = context.data as Partial<RelConnection>;
        if (c.relationshipId && !syncInProgressRef.current) useTreeStore.getState().deleteRelationship(c.relationshipId);
      }
      return context;
    });

    area.addPipe((context) => {
      const ctx = context as Area2D<Schemes>;
      if (ctx.type === "nodetranslated") {
        const { id, position, previous } = ctx.data;
        const dx = position.x - previous.x;
        const dy = position.y - previous.y;
        if (!syncInProgressRef.current && (dx !== 0 || dy !== 0)) {
          const node = editor.getNode(id);
          if (node && isGroupNode(node)) {
            const store = useTreeStore.getState();
            for (const person of store.people) {
              if (person.groupId !== node.groupId) continue;
              const pnode = personNodeMapRef.current.get(person.id);
              if (!pnode) continue;
              const pview = area.nodeViews.get(pnode.id);
              if (!pview) continue;
              void area.translate(pnode.id, { x: pview.position.x + dx, y: pview.position.y + dy });
            }
          }
        }
      }
      if (ctx.type === "nodedragged") {
        const node = ctx.data;
        const view = area.nodeViews.get(node.id);
        if (view) {
          const pos = isGroupNode(node)
            ? { x: Math.round(view.position.x), y: Math.round(view.position.y) }
            : (() => {
                const snapY = genGridRef.current ? GEN_ROW_HEIGHT : GRID_SIZE;
                return {
                  x: Math.round(view.position.x / GRID_SIZE) * GRID_SIZE,
                  y: Math.round(view.position.y / snapY) * snapY,
                };
              })();
          if (pos.x !== view.position.x || pos.y !== view.position.y) void area.translate(node.id, pos);

          const store = useTreeStore.getState();
          if (isPersonNode(node)) {
            handlePersonDragEnd(node.personId, pos, t);
          } else if (isGroupNode(node)) {
            const prevGroup = store.groups.find((g) => g.id === node.groupId);
            store.updateGroup(node.groupId, { position: pos });
            if (prevGroup) {
              const dx = pos.x - prevGroup.position.x;
              const dy = pos.y - prevGroup.position.y;
              if (dx !== 0 || dy !== 0) {
                for (const person of store.people) {
                  let isMember = person.groupId === node.groupId;
                  if (!isMember && !person.groupId) {
                    const layout = computeCardLayout(person, t);
                    const p0 = person.position ?? { x: 0, y: 0 };
                    const cx = p0.x + layout.width / 2;
                    const cy = p0.y + layout.height / 2;
                    isMember =
                      cx >= prevGroup.position.x &&
                      cx <= prevGroup.position.x + prevGroup.size.width &&
                      cy >= prevGroup.position.y &&
                      cy <= prevGroup.position.y + prevGroup.size.height;
                  }
                  if (!isMember) continue;
                  const p = person.position ?? { x: 0, y: 0 };
                  store.updatePerson(person.id, {
                    position: { x: p.x + dx, y: p.y + dy },
                    groupId: node.groupId,
                  });
                }
              }
            }
          }
        }
      }
      if (ctx.type === "translated" || ctx.type === "zoomed") {
        setTransform({ x: area.area.transform.x, y: area.area.transform.y, k: area.area.transform.k });
        if (viewportSyncTimerRef.current) clearTimeout(viewportSyncTimerRef.current);
        viewportSyncTimerRef.current = setTimeout(() => syncRef.current(), 200);
      }
      return context;
    });

    editorRef.current = editor;
    areaRef.current = area;
    areaInstanceRef.current = area;
    editorInstanceRef.current = editor;
    setReady(true);

    return () => {
      setReady(false);
      editorRef.current = null;
      areaRef.current = null;
      areaInstanceRef.current = null;
      editorInstanceRef.current = null;
      area.destroy();
    };
  }, [t, handlePersonDragEnd]);

  const runSyncPass = useCallback(async () => {
    const editor = editorRef.current;
    const area = areaRef.current;
    if (!editor || !area) return;
    const seq = ++syncSeqRef.current;
    const stale = () => seq !== syncSeqRef.current;

    const { people, relationships, groups } = useTreeStore.getState();
    const layouts = new Map(people.map((p) => [p.id, computeCardLayout(p, t)]));
    const visible = getVisibleWorldRect(area);

    const wantedPersonIds = new Set(
      people
        .filter((p) => {
          const l = layouts.get(p.id)!;
          const pos = p.position ?? { x: 0, y: 0 };
          return rectsIntersect({ x: pos.x, y: pos.y, width: l.width, height: l.height }, visible);
        })
        .map((p) => p.id),
    );
    const onScreenPersonIds = new Set(wantedPersonIds);
    for (const rel of relationships) {
      if (onScreenPersonIds.has(rel.fromId)) wantedPersonIds.add(rel.toId);
      if (onScreenPersonIds.has(rel.toId)) wantedPersonIds.add(rel.fromId);
    }
    const wantedGroupIds = new Set(
      groups
        .filter((g) => rectsIntersect({ x: g.position.x, y: g.position.y, width: g.size.width, height: g.size.height }, visible))
        .map((g) => g.id),
    );

    for (const node of editor.getNodes()) {
      const stillWanted = isPersonNode(node)
        ? wantedPersonIds.has(node.personId)
        : isGroupNode(node)
          ? wantedGroupIds.has(node.groupId)
          : false;
      if (!stillWanted) {
        for (const conn of editor.getConnections()) {
          if (conn.source === node.id || conn.target === node.id) await editor.removeConnection(conn.id);
        }
        await editor.removeNode(node.id);
        if (stale()) return;
      }
    }

    const personNodeByPersonId = new Map<string, PersonRete>();
    for (const node of editor.getNodes()) if (isPersonNode(node)) personNodeByPersonId.set(node.personId, node);
    const groupNodeByGroupId = new Map<string, GroupRete>();
    for (const node of editor.getNodes()) if (isGroupNode(node)) groupNodeByGroupId.set(node.groupId, node);

    for (const person of people) {
      if (!wantedPersonIds.has(person.id)) continue;
      const layout = layouts.get(person.id)!;
      let node = personNodeByPersonId.get(person.id);
      if (!node) {
        node = new PersonRete(person.id);
        node.width = layout.width;
        node.height = layout.height;
        await editor.addNode(node);
        if (stale()) return;
        setNodeZIndex(area, node.id, "1");
        await area.translate(node.id, person.position ?? { x: 0, y: 0 });
        if (stale()) return;
        personNodeByPersonId.set(person.id, node);
        continue;
      }
      if (node.width !== layout.width || node.height !== layout.height) {
        node.width = layout.width;
        node.height = layout.height;
        await area.resize(node.id, layout.width, layout.height);
        if (stale()) return;
      }
      const view = area.nodeViews.get(node.id);
      const target = person.position ?? { x: 0, y: 0 };
      if (view && (Math.abs(view.position.x - target.x) > 0.5 || Math.abs(view.position.y - target.y) > 0.5)) {
        await area.translate(node.id, target);
        if (stale()) return;
      }
    }
    personNodeMapRef.current = personNodeByPersonId;

    for (const group of groups) {
      if (!wantedGroupIds.has(group.id)) continue;
      let node = groupNodeByGroupId.get(group.id);
      if (!node) {
        node = new GroupRete(group.id);
        node.width = group.size.width;
        node.height = group.size.height;
        await editor.addNode(node);
        if (stale()) return;
        setNodeZIndex(area, node.id, "0");
        await area.translate(node.id, group.position);
        if (stale()) return;
        await area.resize(node.id, group.size.width, group.size.height);
        if (stale()) return;
        groupNodeByGroupId.set(group.id, node);
        continue;
      }
      if (node.width !== group.size.width || node.height !== group.size.height) {
        node.width = group.size.width;
        node.height = group.size.height;
        await area.resize(node.id, group.size.width, group.size.height);
        if (stale()) return;
      }
      const view = area.nodeViews.get(node.id);
      if (
        view &&
        (Math.abs(view.position.x - group.position.x) > 0.5 || Math.abs(view.position.y - group.position.y) > 0.5)
      ) {
        await area.translate(node.id, group.position);
        if (stale()) return;
      }
    }

    const relById = new Map(relationships.map((r) => [r.id, r]));
    for (const conn of editor.getConnections()) {
      if (!relById.has(conn.relationshipId)) {
        await editor.removeConnection(conn.id);
        if (stale()) return;
      }
    }
    const existingRelIds = new Set(editor.getConnections().map((c) => c.relationshipId));
    for (const rel of relationships) {
      if (existingRelIds.has(rel.id)) continue;
      const source = personNodeByPersonId.get(rel.fromId);
      const target = personNodeByPersonId.get(rel.toId);
      if (!source || !target) continue;
      const conn =
        rel.type === "SPOUSE"
          ? new RelConnection(rel.id, "spouse", source, "spouseOut", target, "spouseIn")
          : new RelConnection(rel.id, "parent", source, "child", target, "parent");
      try {
        await editor.addConnection(conn);
      } catch {
        // Skips duplicate/self connections the veto pipe would also reject.
      }
      if (stale()) return;
    }
  }, [t]);

  const syncRunningRef = useRef(false);
  const syncPendingRef = useRef(false);
  const sync = useCallback(async () => {
    if (syncRunningRef.current) {
      syncPendingRef.current = true;
      return;
    }
    syncRunningRef.current = true;
    syncInProgressRef.current = true;
    try {
      do {
        syncPendingRef.current = false;
        await runSyncPass();
      } while (syncPendingRef.current);
    } finally {
      syncRunningRef.current = false;
      syncInProgressRef.current = false;
    }
  }, [runSyncPass]);

  useEffect(() => {
    syncRef.current = () => void sync();
  }, [sync]);

  useEffect(() => {
    if (!ready) return;
    const unsub = useTreeStore.subscribe(() => {
      void sync();
    });
    void sync();
    return () => {
      unsub();
      if (viewportSyncTimerRef.current) clearTimeout(viewportSyncTimerRef.current);
    };
  }, [ready, sync]);

  const setGenGridActive = useCallback((active: boolean) => {
    genGridRef.current = active;
  }, []);

  return { containerRef, editorRef, areaRef, ready, transform, setGenGridActive };
};
