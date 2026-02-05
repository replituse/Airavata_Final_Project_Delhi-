import { useCallback, useRef, useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Circle, 
  GitCommitHorizontal, 
  Cylinder, 
  ArrowRightCircle, 
  Lock,
  Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  NodeChange,
  EdgeChange,
  Connection,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
  ControlButton
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import { useNetworkStore, WhamoNode, WhamoEdge } from '@/lib/store';
import { ReservoirNode, SimpleNode, JunctionNode, SurgeTankNode, FlowBoundaryNode } from '@/components/NetworkNode';
import { ConnectionEdge } from '@/components/ConnectionEdge';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Toolbar } from '@/components/Toolbar';
import { generateInpFile } from '@/lib/inp-generator';
import { parseInpFile } from '@/lib/inp-parser';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const nodeTypes = {
  reservoir: ReservoirNode,
  node: SimpleNode,
  junction: JunctionNode,
  surgeTank: SurgeTankNode,
  flowBoundary: FlowBoundaryNode,
};

const edgeTypes = {
  connection: ConnectionEdge,
};

function DesignerInner() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  // We connect local ReactFlow state to our global Zustand store for properties panel sync
  const { 
    nodes, 
    edges, 
    computationalParams,
    outputRequests,
    onNodesChange: storeOnNodesChange, 
    onEdgesChange: storeOnEdgesChange,
    onConnect: storeOnConnect, 
    selectElement, 
    loadNetwork,
    clearNetwork,
    deleteElement,
    selectedElementId,
    selectedElementType,
    isLocked,
    toggleLock
  } = useNetworkStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Keyboard shortcuts for zoom and view
      if (event.key === '+' || event.key === '=') {
        zoomIn();
      } else if (event.key === '-' || event.key === '_') {
        zoomOut();
      } else if (event.key.toLowerCase() === 'f') {
        fitView();
      } else if (event.key.toLowerCase() === 'l') {
        toggleLock();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && 
          selectedElementId && 
          selectedElementType) {
        deleteElement(selectedElementId, selectedElementType);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteElement, selectedElementId, selectedElementType, zoomIn, zoomOut, fitView, toggleLock]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isLocked) return;
      storeOnNodesChange(changes);
    },
    [storeOnNodesChange, isLocked]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isLocked) return;
      storeOnEdgesChange(changes);
    },
    [storeOnEdgesChange, isLocked]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isLocked) return;
      if (params.source === params.target) {
        toast({
          variant: "destructive",
          title: "Invalid Connection",
          description: "An element cannot be connected to itself.",
        });
        return;
      }
      storeOnConnect(params);
    },
    [storeOnConnect, toast, isLocked]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectElement(node.id, 'node');
  }, [selectElement]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectElement(edge.id, 'edge');
  }, [selectElement]);

  const onSelectionChange = useCallback(({ nodes, edges }: { nodes: WhamoNode[], edges: WhamoEdge[] }) => {
    if (nodes.length > 0) {
      selectElement(nodes[0].id, 'node');
    } else if (edges.length > 0) {
      selectElement(edges[0].id, 'edge');
    } else {
      selectElement(null, null);
    }
  }, [selectElement]);

  const handleSave = () => {
    const data = { 
      nodes, 
      edges,
      computationalParams,
      outputRequests
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `whamo_project_${Date.now()}.json`);
    toast({ title: "Project Saved", description: "Network topology saved to JSON." });
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        if (fileName.endsWith('.json')) {
          const json = JSON.parse(content);
          if (json.nodes && json.edges) {
            loadNetwork(json.nodes, json.edges, json.computationalParams, json.outputRequests);
            toast({ title: "Project Loaded", description: "Network topology restored from JSON." });
          } else {
            throw new Error("Invalid JSON format");
          }
        } else if (fileName.endsWith('.inp')) {
          const { nodes, edges } = parseInpFile(content);
          if (nodes.length > 0) {
            loadNetwork(nodes, edges);
            toast({ title: "Project Loaded", description: "Network topology restored from .inp file." });
          } else {
            throw new Error("No valid network elements found in .inp file");
          }
        } else {
          throw new Error("Unsupported file type");
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Load Failed", description: err instanceof Error ? err.message : "Invalid file." });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleGenerateInp = () => {
    try {
      generateInpFile(nodes, edges);
      toast({ title: "INP Generated", description: "WHAMO input file downloaded successfully." });
    } catch (err) {
      toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate .inp file. Check connections." });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json,.inp" 
        className="hidden" 
      />

      {/* Top Bar */}
      <Toolbar 
        onExport={handleGenerateInp} 
        onSave={handleSave} 
        onLoad={handleLoadClick} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 relative h-full bg-slate-50 transition-all duration-300">
          <ReactFlow
            nodes={nodes as any}
            edges={edges as any}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onSelectionChange={onSelectionChange as any}
            fitView
            className="bg-slate-50"
            proOptions={{ hideAttribution: true }}
            nodesDraggable={!isLocked}
            nodesConnectable={!isLocked}
            elementsSelectable={true}
          >
            <Background color="#94a3b8" gap={20} size={1} />
            <Controls className="!bg-white !shadow-xl !border-border">
              <ControlButton 
                onClick={toggleLock} 
                title={isLocked ? "Unlock Network" : "Lock Network"}
                className={cn(isLocked && "bg-slate-100")}
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </ControlButton>
            </Controls>
          </ReactFlow>
          
          {isLocked && (
            <div className="absolute top-4 right-4 bg-orange-100 text-orange-800 px-3 py-1 rounded-md text-sm font-medium border border-orange-200 shadow-sm z-50 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              Network Locked
            </div>
          )}
        </div>

        {/* Properties Panel (Sidebar) */}
        <div 
          className={cn(
            "h-full border-l border-border bg-card shadow-2xl z-20 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
            selectedElementId ? "w-[350px] opacity-100 visible" : "w-0 opacity-0 invisible"
          )}
        >
          <div className="w-[350px] h-full">
            {selectedElementId && <PropertiesPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Designer() {
  return (
    <ReactFlowProvider>
      <DesignerInner />
    </ReactFlowProvider>
  );
}
