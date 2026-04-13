import React, { useMemo, useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ConnectionMode,
  useNodesState,
} from 'reactflow';
import type { Node, Edge, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { useTreeStore } from '../store/useTreeStore';
import { useTranslation } from 'react-i18next';
import PersonNode from './PersonNode';
import dagre from 'dagre';
import {
  buildLogicalEdges,
  buildTreePdf,
  buildTreeSvg,
  toPersonNodes,
  type ExportOptions,
  type PaperFormat,
  type Orientation,
  type PageLayout,
} from '../utils/treeExport';

const nodeTypes = {
  person: PersonNode,
};

const GRID_SIZE = 20;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 150, ranksep: 100 });

  for (const node of nodes) {
    const isFamily = node.id.startsWith('family-');
    dagreGraph.setNode(node.id, { width: isFamily ? 10 : 200, height: isFamily ? 10 : 80 });
  }
  for (const edge of edges) dagreGraph.setEdge(edge.source, edge.target);

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    const isFamily = node.id.startsWith('family-');
    return {
      ...node,
      position: {
        x: pos.x - (isFamily ? 5 : 100),
        y: pos.y - (isFamily ? 5 : 40),
      },
    };
  });
};

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'svg', opts: ExportOptions) => void;
  defaultTitle: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, onExport, defaultTitle }) => {
  const { t } = useTranslation();
  const [paper, setPaper] = useState<PaperFormat>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [layout, setLayout] = useState<PageLayout>('multi');
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeIndex, setIncludeIndex] = useState(false);
  const [title, setTitle] = useState(defaultTitle);

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const buildOpts = (): ExportOptions => ({
    format: paper,
    orientation,
    layout,
    margin: 32,
    includeTitle,
    includeIndex,
    title,
    subtitle: new Date().toLocaleDateString(),
    t,
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">{t('exportOptions')}</h2>

        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('title')}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('paperFormat')}</label>
            <select
              value={paper}
              onChange={(e) => setPaper(e.target.value as PaperFormat)}
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="a3">A3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('orientation')}</label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as Orientation)}
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
            >
              <option value="auto">{t('auto')}</option>
              <option value="portrait">{t('portrait')}</option>
              <option value="landscape">{t('landscape')}</option>
            </select>
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-600 mb-1">{t('pageLayout')}</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setLayout('single')}
            className={`py-2 rounded-lg text-sm border transition-colors ${
              layout === 'single'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('singlePage')}
          </button>
          <button
            type="button"
            onClick={() => setLayout('multi')}
            className={`py-2 rounded-lg text-sm border transition-colors ${
              layout === 'multi'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('multiPage')}
          </button>
        </div>

        <div className="space-y-2 mb-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeTitle}
              onChange={(e) => setIncludeTitle(e.target.checked)}
              className="accent-emerald-600"
            />
            {t('includeTitle')}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeIndex}
              onChange={(e) => setIncludeIndex(e.target.checked)}
              className="accent-emerald-600"
            />
            {t('includeIndex')}
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onExport('svg', buildOpts())}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 text-white hover:bg-slate-800"
          >
            {t('exportSvg')}
          </button>
          <button
            type="button"
            onClick={() => onExport('pdf', buildOpts())}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {t('exportPdf')}
          </button>
        </div>
      </div>
    </div>
  );
};

const TreeView: React.FC = () => {
  const { people, relationships, setSelectedPersonId, addRelationship, updatePerson } = useTreeStore();
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const logicalEdges = useMemo(
    () => buildLogicalEdges(people, relationships),
    [people, relationships]
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      logicalEdges.map((e) =>
        e.kind === 'spouse'
          ? {
              id: e.id,
              source: e.sourceId,
              target: e.targetId,
              sourceHandle: 'spouse-right',
              targetHandle: 'spouse-left',
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#10b981', strokeWidth: 2 },
            }
          : {
              id: e.id,
              source: e.sourceId,
              target: e.targetId,
              sourceHandle: 'child',
              targetHandle: 'parent',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
              style: { stroke: '#64748b', strokeWidth: 2 },
              type: 'step',
            }
      ),
    [logicalEdges]
  );

  const buildFlowNodes = useCallback(
    (): Node[] =>
      people.map((person) => ({
        id: person.id,
        type: 'person',
        data: person,
        position: person.position ? { x: person.position.x, y: person.position.y } : { x: 0, y: 0 },
      })),
    [people]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(buildFlowNodes());

  useEffect(() => {
    setNodes(buildFlowNodes());
  }, [buildFlowNodes, setNodes]);

  const exportTitle = useMemo(() => t('appName') + ' — ' + t('tagline'), [t]);

  const performExport = useCallback(
    async (format: 'pdf' | 'svg', opts: ExportOptions) => {
      setDialogOpen(false);
      setIsExporting(true);
      try {
        const exportNodes = toPersonNodes(
          people.map((p) => {
            const live = nodes.find((n) => n.id === p.id);
            if (live?.position) return { ...p, position: { x: live.position.x, y: live.position.y } };
            return p;
          })
        );
        if (format === 'pdf') {
          const pdf = buildTreePdf(exportNodes, logicalEdges, opts);
          pdf.save('family-tree.pdf');
        } else {
          const svg = buildTreeSvg(exportNodes, logicalEdges, t, {
            title: opts.includeTitle ? opts.title : undefined,
            subtitle: opts.includeTitle ? opts.subtitle : undefined,
          });
          const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'family-tree.svg';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        alert('Failed to export');
      } finally {
        setIsExporting(false);
      }
    },
    [people, nodes, logicalEdges, t]
  );

  const printTree = useCallback(() => {
    setIsExporting(true);
    try {
      const exportNodes = toPersonNodes(
        people.map((p) => {
          const live = nodes.find((n) => n.id === p.id);
          if (live?.position) return { ...p, position: { x: live.position.x, y: live.position.y } };
          return p;
        })
      );
      const svg = buildTreeSvg(exportNodes, logicalEdges, t, { title: t('appName') });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const w = window.open('', '_blank');
      if (!w) {
        alert('Unable to open print window');
        return;
      }
      w.document.write(`<!doctype html><html><head><title>${t('appName')}</title></head><body style="margin:0;padding:0;">`);
      w.document.write(`<img src="${url}" style="width:100%; height:auto; display:block;"/>`);
      w.document.write(`</body></html>`);
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      }, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      alert('Failed to print');
      setIsExporting(false);
    }
  }, [people, nodes, logicalEdges, t]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!node.id || !node.position) return;
      const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;
      const snapped = { x: snap(node.position.x), y: snap(node.position.y) };
      setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: snapped } : n)));
      updatePerson(node.id, { position: snapped });
    },
    [updatePerson, setNodes]
  );

  const autoArrange = useCallback(() => {
    const flowNodes: Node[] = people.map((person) => ({
      id: person.id,
      type: 'person',
      data: person,
      position: { x: 0, y: 0 },
    }));
    const layoutEdges: Edge[] = [];
    const childrenByParent = new Map<string, Set<string>>();
    const spouseRels = relationships.filter((r) => r.type === 'SPOUSE');
    const parentChildRels = relationships.filter((r) => r.type === 'PARENT_CHILD');
    for (const r of parentChildRels) {
      let set = childrenByParent.get(r.fromId);
      if (!set) {
        set = new Set();
        childrenByParent.set(r.fromId, set);
      }
      set.add(r.toId);
    }
    const processedParentChild = new Set<string>();

    for (const rel of spouseRels) {
      const p1 = rel.fromId;
      const p2 = rel.toId;
      const pairKey = p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
      const c1 = childrenByParent.get(p1);
      const c2 = childrenByParent.get(p2);
      const common: string[] = [];
      if (c1 && c2) {
        const [small, big] = c1.size <= c2.size ? [c1, c2] : [c2, c1];
        for (const id of small) if (big.has(id)) common.push(id);
      }
      if (common.length > 0) {
        const familyNodeId = `family-${pairKey}`;
        flowNodes.push({
          id: familyNodeId,
          type: 'default',
          data: { label: '' },
          position: { x: 0, y: 0 },
          style: { width: 10, height: 10 },
        });
        layoutEdges.push({ id: `e-${p1}-${familyNodeId}`, source: p1, target: familyNodeId });
        layoutEdges.push({ id: `e-${p2}-${familyNodeId}`, source: p2, target: familyNodeId });
        for (const childId of common) {
          layoutEdges.push({ id: `e-${familyNodeId}-${childId}`, source: familyNodeId, target: childId });
          processedParentChild.add(`${p1}|${childId}`);
          processedParentChild.add(`${p2}|${childId}`);
        }
      } else {
        layoutEdges.push({ id: rel.id, source: p1, target: p2 });
      }
    }
    for (const rel of parentChildRels) {
      if (processedParentChild.has(`${rel.fromId}|${rel.toId}`)) continue;
      layoutEdges.push({ id: rel.id, source: rel.fromId, target: rel.toId });
    }

    const layouted = getLayoutedElements(flowNodes, layoutEdges);
    for (const node of layouted) {
      if (node.id.startsWith('family-')) continue;
      const pos = node.position;
      if (pos) updatePerson(node.id, { position: { x: Math.round(pos.x), y: Math.round(pos.y) } });
    }
  }, [people, relationships, updatePerson]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'person') setSelectedPersonId(node.id);
    },
    [setSelectedPersonId]
  );

  const onPaneClick = useCallback(() => setSelectedPersonId(null), [setSelectedPersonId]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const type: 'SPOUSE' | 'PARENT_CHILD' =
        params.sourceHandle?.includes('spouse') || params.targetHandle?.includes('spouse')
          ? 'SPOUSE'
          : 'PARENT_CHILD';
      addRelationship({ fromId: params.source, toId: params.target, type });
    },
    [addRelationship]
  );

  return (
    <div id="reactflow-wrapper" className="w-full h-full bg-slate-50 relative">
      <div className="absolute right-6 top-6 z-30">
        <div className="flex gap-2">
          <button
            onClick={autoArrange}
            disabled={isExporting}
            className="bg-emerald-600 text-white py-1.5 px-3 rounded-lg shadow-sm text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('autoArrange')}
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            disabled={isExporting || people.length === 0}
            className="bg-slate-800 text-white py-1.5 px-3 rounded-lg shadow-sm text-xs font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? t('exporting') : t('exportTree')}
          </button>
          <button
            onClick={printTree}
            disabled={isExporting || people.length === 0}
            className="bg-slate-600 text-white py-1.5 px-3 rounded-lg shadow-sm text-xs font-bold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? t('preparing') : t('print')}
          </button>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        fitView
        elevateNodesOnSelect={false}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ zIndex: 0 }}
        onlyRenderVisibleElements
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>

      <ExportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onExport={performExport}
        defaultTitle={exportTitle}
      />
    </div>
  );
};

export default TreeView;
