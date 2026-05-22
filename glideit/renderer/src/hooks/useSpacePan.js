import { useState, useEffect } from 'react';

/**
 * Returns isPanning = true while Space is held.
 * The parent component uses this to toggle panOnDrag on the ReactFlow element.
 */
export function useSpacePan() {
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      // Only fire when space is pressed and not in an input field
      if (e.code === 'Space') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        setIsPanning(true);
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsPanning(false);
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    globalThis.addEventListener('keyup', onKeyUp);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
      globalThis.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return isPanning;
}
