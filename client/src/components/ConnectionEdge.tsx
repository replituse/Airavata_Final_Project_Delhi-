import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  BaseEdge,
} from '@xyflow/react';

export const ConnectionEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate the angle for the arrow at the end of the path
  // We look at the last segment of the bezier curve
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: 2,
        }} 
      />
    </>
  );
});
