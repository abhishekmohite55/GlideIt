import React from 'react';
import { BaseEdge, getBezierPath } from '@xyflow/react';

export default function ParallelEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}) {
  const offset = data?.offset || 0;
  
  // Calculate vector from source to target
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  // Normal vector (perpendicular)
  let nx = 0;
  let ny = 0;
  if (length > 0) {
    nx = -dy / length;
    ny = dx / length;
  }

  // Spread parallel edges by 12px per index
  const shift = offset * 12;

  // Apply shift to both source and target anchors
  const shiftedSourceX = sourceX + nx * shift;
  const shiftedSourceY = sourceY + ny * shift;
  const shiftedTargetX = targetX + nx * shift;
  const shiftedTargetY = targetY + ny * shift;

  // Generate bezier path using shifted coordinates
  const [edgePath] = getBezierPath({
    sourceX: shiftedSourceX,
    sourceY: shiftedSourceY,
    sourcePosition,
    targetX: shiftedTargetX,
    targetY: shiftedTargetY,
    targetPosition,
  });

  return (
    <BaseEdge
      path={edgePath}
      style={style}
      markerEnd={markerEnd}
    />
  );
}
