import { WhamoNode, WhamoEdge } from './store';

export function parseInpFile(content: string): { nodes: WhamoNode[], edges: WhamoEdge[] } {
  const nodes: WhamoNode[] = [];
  const edges: WhamoEdge[] = [];
  const lines = content.split('\n');
  
  const nodeElevations: Record<string, number> = {};
  
  // First pass: find node elevations
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('NODE')) {
      const parts = trimmed.split(/\s+/);
      // NODE 1 ELEV 4022.31
      if (parts.length >= 4 && parts[2] === 'ELEV') {
        nodeElevations[parts[1]] = parseFloat(parts[3]);
      }
    }
  });

  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('c') || line.startsWith('C')) continue;

    if (line.startsWith('RESERVOIR')) {
      const idLine = lines[++i]?.trim() || '';
      const elevLine = lines[++i]?.trim() || '';
      const id = idLine.replace('ID ', '').trim();
      const elev = parseFloat(elevLine.replace('ELEV ', '').trim());
      
      // Find node number from ELEM section (simplified for now)
      // In a real parser we'd track the full topology
      nodes.push({
        id: id,
        type: 'reservoir',
        position: { x: 50, y: 100 + nodes.length * 100 },
        data: {
          label: id,
          type: 'reservoir',
          elevation: elev,
          nodeNumber: parseInt(id) || nodes.length + 1
        }
      });
      continue;
    }

    if (line.startsWith('CONDUIT ID')) {
      const parts = line.split(/\s+/);
      const id = parts[2];
      const isDummy = lines[i+1]?.trim() === 'DUMMY';
      
      if (isDummy) {
        i += 1; // skip DUMMY
        const diamLine = lines[++i]?.trim() || '';
        const diameter = parseFloat(diamLine.replace('DIAMETER ', '').trim());
        
        edges.push({
          id: `edge-${id}`,
          source: '', // Need topology mapping
          target: '',
          type: 'connection',
          data: {
            label: id,
            type: 'dummy',
            diameter
          }
        });
      } else {
        // Regular conduit
        // CONDUIT ID C1 LENG 13405.51 DIAM 34.45 CELE 2852.51 FRIC 0.008
        const length = parseFloat(parts[parts.indexOf('LENG') + 1]);
        const diameter = parseFloat(parts[parts.indexOf('DIAM') + 1]);
        const celerity = parseFloat(parts[parts.indexOf('CELE') + 1]);
        const friction = parseFloat(parts[parts.indexOf('FRIC') + 1]);
        
        edges.push({
          id: `edge-${id}`,
          source: '',
          target: '',
          type: 'connection',
          data: {
            label: id,
            type: 'conduit',
            length,
            diameter,
            celerity,
            friction
          }
        });
      }
    }
    
    // Simplification: In a real app, this parser would be much more robust
    // For this demo, we'll focus on demonstrating the multi-format support
  }

  return { nodes, edges };
}
