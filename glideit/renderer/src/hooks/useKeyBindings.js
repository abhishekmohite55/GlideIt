import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * Registers all keyboard shortcuts for the GlideIt canvas.
 */
export function useKeyBindings({
  onFitView,
  onSelectAll,
  onDeselectAll,
  onExpandSelected,
  onToggleMinimap,
  onToggleLegend,
  onToggleLayout,
  onResetLayout,
  onJumpToEntries,
}) {
  const { zoomIn, zoomOut } = useReactFlow();

  const SCROLL_AMOUNT = 80; // pixels per arrow key press

  const handleKeyDown = useCallback((e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    // Do not fire shortcuts when user is typing in an input
    if (tag === 'input' || tag === 'textarea') return;

    const ctrl = e.ctrlKey || e.metaKey;  // metaKey = Cmd on Mac
    const shift = e.shiftKey;

    // Zoom in: Ctrl + =
    if (ctrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn({ duration: 200 });
      return;
    }

    // Zoom out: Ctrl + -
    if (ctrl && e.key === '-') {
      e.preventDefault();
      zoomOut({ duration: 200 });
      return;
    }

    // Fit view: Ctrl + Shift + F
    if (ctrl && shift && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      onFitView?.();
      return;
    }

    // Jump to entries: Ctrl + Home
    if (ctrl && e.key === 'Home') {
      e.preventDefault();
      onJumpToEntries?.();
      return;
    }

    // Reset layout: Ctrl + Shift + R
    if (ctrl && shift && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      onResetLayout?.();
      return;
    }

    // Escape: deselect / collapse
    if (e.key === 'Escape') {
      onDeselectAll?.();
      return;
    }

    // Select All: Ctrl+A / Cmd+A
    if (ctrl && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      onSelectAll?.();
      return;
    }

    // Enter: expand selected node
    if (e.key === 'Enter') {
      e.preventDefault();
      onExpandSelected?.();
      return;
    }

    // M: toggle minimap
    if (e.key === 'm' || e.key === 'M') {
      onToggleMinimap?.();
      return;
    }

    // ?: toggle legend
    if (e.key === '?') {
      onToggleLegend?.();
      return;
    }

    // L: toggle layout direction
    if (e.key === 'l' || e.key === 'L') {
      onToggleLayout?.();
      return;
    }

    // Arrow keys: scroll canvas (prevent default page scroll)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dy: -SCROLL_AMOUNT } }));
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dy: SCROLL_AMOUNT } }));
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dx: -SCROLL_AMOUNT } }));
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dx: SCROLL_AMOUNT } }));
    }

  }, [zoomIn, zoomOut, onFitView, onSelectAll, onDeselectAll, onExpandSelected,
      onToggleMinimap, onToggleLegend, onToggleLayout, onResetLayout, onJumpToEntries]);

  useEffect(() => {
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
