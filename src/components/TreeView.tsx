import React, { useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  MarkerType,
  ConnectionMode,
  Handle,
  Position,
} from 'reactflow';
import type { Node, Edge, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { useTreeStore } from '../store/useTreeStore';
import PersonNode from './PersonNode';
import dagre from 'dagre';

const nodeTypes = {
  person: PersonNode,
};

const TreeView: React.FC = () => {
  const { people, relationships, setSelectedPersonId, addRelationship } = useTreeStore();

  const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 150, ranksep: 100 });

    nodes.forEach((node) => {
      const isFamily = node.id.startsWith('family-');
      dagreGraph.setNode(node.id, { width: isFamily ? 10 : 200, height: isFamily ? 10 : 80 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const isFamily = node.id.startsWith('family-');
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (isFamily ? 5 : 100),
          y: nodeWithPosition.y - (isFamily ? 5 : 40),
        },
      };
    });
  };

  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    people.forEach((person) => {
      flowNodes.push({
        id: person.id,
        type: 'person',
        data: person,
        position: { x: 0, y: 0 },
      });
    });

    const spouseRelationships = relationships.filter(r => r.type === 'SPOUSE');
    const parentChildRelationships = relationships.filter(r => r.type === 'PARENT_CHILD');
    const processedParentPairs = new Set<string>();

    spouseRelationships.forEach(rel => {
      const p1 = rel.fromId;
      const p2 = rel.toId;
      const pairKey = [p1, p2].sort().join('-');
      
      const p1Children = parentChildRelationships.filter(r => r.fromId === p1).map(r => r.toId);
      const p2Children = parentChildRelationships.filter(r => r.fromId === p2).map(r => r.toId);
      const commonChildren = p1Children.filter(cId => p2Children.includes(cId));

      if (commonChildren.length > 0) {
        const familyNodeId = `family-${pairKey}`;
        
        flowNodes.push({
          id: familyNodeId,
          type: 'default',
          data: { label: '' },
          position: { x: 0, y: 0 },
          style: { width: 10, height: 10, borderRadius: '50%', padding: 0, background: '#94a3b8', border: 'none' },
        });

        flowEdges.push({
          id: `e-${p1}-${familyNodeId}`,
          source: p1,
          target: familyNodeId,
          sourceHandle: 'child',
          style: { stroke: '#10b981', strokeWidth: 2 },
          type: 'smoothstep',
        });
        flowEdges.push({
          id: `e-${p2}-${familyNodeId}`,
          source: p2,
          target: familyNodeId,
          sourceHandle: 'child',
          style: { stroke: '#10b981', strokeWidth: 2 },
          type: 'smoothstep',
        });

        commonChildren.forEach(childId => {
          flowEdges.push({
            id: `e-${familyNodeId}-${childId}`,
            source: familyNodeId,
            target: childId,
            targetHandle: 'parent',
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
            style: { stroke: '#64748b', strokeWidth: 2 },
            type: 'step',
          });
        });

        processedParentPairs.add(pairKey);
      } else {
        flowEdges.push({
          id: rel.id,
          source: rel.fromId,
          target: rel.toId,
          sourceHandle: 'spouse-right',
          targetHandle: 'spouse-left',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2 },
        });
      }
    });

    parentChildRelationships.forEach(rel => {
      const parentId = rel.fromId;
      const childId = rel.toId;
      
      let isProcessed = false;
      spouseRelationships.forEach(sRel => {
        const otherParentId = sRel.fromId === parentId ? sRel.toId : sRel.fromId;
        const pairKey = [parentId, otherParentId].sort().join('-');
        if (processedParentPairs.has(pairKey)) {
          const otherParentHasChild = parentChildRelationships.some(r => r.fromId === otherParentId && r.toId === childId);
          if (otherParentHasChild) isProcessed = true;
        }
      });

      if (!isProcessed) {
        flowEdges.push({
          id: rel.id,
          source: parentId,
          target: childId,
          sourceHandle: 'child',
          targetHandle: 'parent',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
          style: { stroke: '#64748b', strokeWidth: 2 },
          type: 'step',
        });
      }
    });

    const layoutedNodes = getLayoutedElements(flowNodes, flowEdges);
    return { nodes: layoutedNodes, edges: flowEdges };
  }, [people, relationships]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'person') {
      setSelectedPersonId(node.id);
    }
  }, [setSelectedPersonId]);

  const onPaneClick = useCallback(() => {
    setSelectedPersonId(null);
  }, [setSelectedPersonId]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    
    let type: 'SPOUSE' | 'PARENT_CHILD' = 'PARENT_CHILD';
    if (params.sourceHandle?.includes('spouse') || params.targetHandle?.includes('spouse')) {
      type = 'SPOUSE';
    }

    addRelationship({
      fromId: params.source,
      toId: params.target,
      type
    });
  }, [addRelationship]);

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
};

export default TreeView;
