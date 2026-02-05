import { WhamoNode, WhamoEdge, useNetworkStore } from './store';
import { saveAs } from 'file-saver';

export function generateInpFile(nodes: WhamoNode[], edges: WhamoEdge[]) {
  const state = useNetworkStore.getState();
  const lines: string[] = [];

  // Helper to add line
  const add = (str: string) => lines.push(str);
  const addComment = (comment?: string) => {
    if (comment) {
      add(`c ${comment}`);
    }
  };

  const addL = (str: string) => lines.push(str);
  
  addL('c Project Name');
  addL('C  SYSTEM CONNECTIVITY');
  addL('');
  addL('SYSTEM');
  addL('');

  // Connectivity section
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();

  function traverse(nodeId: string) {
    if (visitedNodes.has(nodeId)) return;
    visitedNodes.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Elements AT this node
    if (node.type === 'reservoir') {
      addL(`ELEM ${node.data.label} AT ${node.data.nodeNumber || node.id}`);
    } else if (node.type === 'surgeTank' || node.type === 'flowBoundary') {
      addL(`ELEM ${node.data.label} AT ${node.data.nodeNumber || node.id}`);
    }

    // Outgoing edges
    const outgoingEdges = edges.filter(e => e.source === nodeId);
    
    if (outgoingEdges.length > 0) {
      if (node.type === 'junction' || outgoingEdges.length > 1) {
        addL('');
        addL(`JUNCTION AT ${node.data.nodeNumber || node.id}`);
        addL('');
      }

      outgoingEdges.forEach(edge => {
        if (visitedEdges.has(edge.id)) return;
        visitedEdges.add(edge.id);
        
        const toNode = nodes.find(n => n.id === edge.target);
        const toId = toNode?.data.nodeNumber || toNode?.id || edge.target;
        const fromId = node.data.nodeNumber || node.id;

        addL(`ELEM ${edge.data?.label || edge.id} LINK ${fromId} ${toId}`);
        traverse(edge.target);
      });
    }
  }

  // Start traversal from reservoirs
  const reservoirs = nodes.filter(n => n.type === 'reservoir');
  reservoirs.forEach(r => traverse(r.id));

  // Handle any disconnected components (e.g. ST, FB if not reached by traversal)
  nodes.forEach(n => {
    if (!visitedNodes.has(n.id)) {
      if (n.type === 'surgeTank' || n.type === 'flowBoundary') {
        addL(`ELEM ${n.data.label} AT ${n.data.nodeNumber || n.id}`);
      }
    }
  });

  addL('');
  nodes.forEach(n => {
    if (n.data.elevation !== undefined) {
      addL(`NODE ${n.data.nodeNumber || n.id} ELEV ${n.data.elevation} `);
    }
  });

  addL('');
  addL('FINISH');
  addL('');
  addL('C ELEMENT PROPERTIES');
  addL('');

  // Properties Section
  nodes.filter(n => n.type === 'reservoir').forEach(n => {
    addComment(n.data.comment);
    addL('RESERVOIR');
    addL(` ID ${n.data.label}`);
    addL(` ELEV ${n.data.elevation}`);
    addL(' FINISH');
    addL('');
  });

  edges.filter(e => e.data?.type === 'conduit').forEach(e => {
    const d = e.data;
    if (!d) return;
    addComment(d.comment);
    let line = `CONDUIT ID ${d.label || e.id} LENG ${d.length} DIAM ${d.diameter} CELE ${d.celerity} FRIC ${d.friction} `;
    if (d.cplus !== undefined || d.cminus !== undefined) {
      addL(line);
      let loss = 'ADDEDLOSS ';
      if (d.cplus !== undefined) loss += `CPLUS ${d.cplus} `;
      if (d.cminus !== undefined) loss += `CMINUS ${d.cminus} `;
      if (d.numSegments !== undefined) loss += `NUMSEG ${d.numSegments} `;
      loss += 'FINISH ';
      addL(loss);
    } else {
      if (d.numSegments !== undefined) line += `NUMSEG ${d.numSegments} `;
      line += 'FINISH ';
      addL(line);
    }
  });

  edges.filter(e => e.data?.type === 'dummy').forEach(e => {
    const d = e.data;
    if (!d) return;
    addComment(d.comment);
    addL(`CONDUIT ID ${d.label || e.id} `);
    addL(' DUMMY ');
    addL(` DIAMETER ${d.diameter}`);
    addL(' ADDEDLOSS ');
    if (d.cplus !== undefined) addL(` CPLUS ${d.cplus}`);
    if (d.cminus !== undefined) addL(` CMINUS ${d.cminus}`);
    addL('FINISH');
    addL('');
  });

  nodes.filter(n => n.type === 'surgeTank').forEach(n => {
    const d = n.data;
    if (!d) return;
    addComment(d.comment);
    addL('SURGETANK ');
    addL(` ID ${d.label} SIMPLE`);
    addL(` ELTOP ${d.topElevation}`);
    addL(` ELBOTTOM ${d.bottomElevation}`);
    addL(` DIAM ${d.diameter}`);
    addL(` CELERITY ${d.celerity}`);
    addL(` FRICTION ${d.friction}`);
    addL('FINISH');
    addL('');
  });

  nodes.filter(n => n.type === 'flowBoundary').forEach(n => {
    const d = n.data;
    if (!d) return;
    addComment(d.comment);
    addL(`FLOWBC ID ${d.label} QSCHEDULE ${d.scheduleNumber} FINISH`);
  });

  addL('');
  addL('');
  addL('SCHEDULE');
  
  const flowBoundaries = nodes.filter(n => n.type === 'flowBoundary');
  flowBoundaries.forEach(n => {
    const d = n.data;
    let schedule = '';
    if (d.schedulePoints && Array.isArray(d.schedulePoints) && d.schedulePoints.length > 0) {
      schedule = d.schedulePoints.map((p: any) => `T ${p.time} Q ${p.flow}`).join(' ');
    } else {
      schedule = 'T 0 Q 3000 T 20 Q 0 T 3000 Q 0';
    }
    addL(` QSCHEDULE ${d.scheduleNumber} ${schedule}`);
  });
  
  addL('');
  addL('FINISH');
  addL('');
  addL('');
  addL('C OUTPUT REQUEST');
  addL('');
  if (state.outputRequests.length > 0) {
    addL('HISTORY');
    state.outputRequests.forEach(req => {
      const element = req.elementType === 'node' 
        ? nodes.find(n => n.id === req.elementId)
        : edges.find(e => e.id === req.elementId);
      
      const isSurgeTank = req.elementType === 'node' && element?.data?.type === 'surgeTank';
      const label = isSurgeTank 
        ? (element?.data?.label || element?.id || req.elementId)
        : (element?.data?.nodeNumber || element?.data?.label || element?.id || req.elementId);
      const typeStr = isSurgeTank ? 'ELEM' : 'NODE';
      addL(` ${typeStr} ${label} ${req.variables.join(' ')}`);
    });
    addL(' FINISH');
  } else {
    addL('HISTORY');
    addL(' NODE 2 Q HEAD');
    addL(' ELEM ST Q ELEV');
    addL(' FINISH');
  }
  addL('');
  addL('');
  addL('C COMPUTATIONAL PARAMETERS');
  addL('CONTROL');
  const cp = state.computationalParams;
  addL(` DTCOMP ${cp.dtcomp} DTOUT ${cp.dtout} TMAX ${cp.tmax}`);
  addL('FINISH');
  addL('');
  addL('C EXECUTION CONTROL');
  addL('GO');
  addL('GOODBYE');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `network_${Date.now()}.inp`);
}