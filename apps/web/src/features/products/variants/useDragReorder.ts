'use client';

import { useState } from 'react';

/** Reordenar una lista arrastrando (HTML5 drag & drop), como los "⋮⋮" de Shopify. */
export function useDragReorder<T>(items: T[], onReorder: (items: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);

  const itemProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(index);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragging === null) return;
      e.preventDefault();
      if (dragging === index) return;
      const next = [...items];
      const [moved] = next.splice(dragging, 1);
      next.splice(index, 0, moved);
      setDragging(index);
      onReorder(next);
    },
    onDragEnd: () => setDragging(null),
    'data-dragging': dragging === index || undefined,
  });

  return { itemProps, dragging };
}
