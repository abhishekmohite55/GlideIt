import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

const SCROLL_AMOUNT = 80;

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

  const handleKeyDown = useCallback((e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (ctrl) {
      handleCtrlShortcuts(e, ctrl, shift, { zoomIn, zoomOut, onFitView, onJumpToEntries,
        onResetLayout, onSelectAll });
    } else {
      handlePlainKeys(e, { onDeselectAll, onExpandSelected, onToggleMinimap,
        onToggleLegend, onToggleLayout });
    }
  }, [zoomIn, zoomOut, onFitView, onSelectAll, onDeselectAll, onExpandSelected,
      onToggleMinimap, onToggleLegend, onToggleLayout, onResetLayout, onJumpToEntries]);

  useEffect(() => {
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

function handleCtrlShortcuts(e, ctrl, shift, handlers) {
  const { zoomIn, zoomOut, onFitView, onJumpToEntries, onResetLayout, onSelectAll } = handlers;
  const key = e.key;

  if (ctrl && (key === '=' || key === '+')) {
    e.preventDefault();
    zoomIn({ duration: 200 });
    return;
  }

  if (ctrl && key === '-') {
    e.preventDefault();
    zoomOut({ duration: 200 });
    return;
  }

  if (ctrl && shift && (key === 'f' || key === 'F')) {
    e.preventDefault();
    onFitView?.();
    return;
  }

  if (ctrl && key === 'Home') {
    e.preventDefault();
    onJumpToEntries?.();
    return;
  }

  if (ctrl && shift && (key === 'r' || key === 'R')) {
    e.preventDefault();
    onResetLayout?.();
    return;
  }

  if (ctrl && (key === 'a' || key === 'A')) {
    e.preventDefault();
    onSelectAll?.();
  }
}

function handlePlainKeys(e, handlers) {
  const { onDeselectAll, onExpandSelected, onToggleMinimap, onToggleLegend, onToggleLayout } = handlers;
  const key = e.key;

  if (key === 'Escape') {
    e.preventDefault();
    onDeselectAll?.();
    return;
  }

  if (key === 'Enter') {
    e.preventDefault();
    onExpandSelected?.();
    return;
  }

  if (key === 'm' || key === 'M') {
    e.preventDefault();
    onToggleMinimap?.();
    return;
  }

  if (key === '?') {
    e.preventDefault();
    onToggleLegend?.();
    return;
  }

  if (key === 'l' || key === 'L') {
    e.preventDefault();
    onToggleLayout?.();
    return;
  }

  if (key.startsWith('Arrow')) {
    handleArrowKey(e);
  }
}

function handleArrowKey(e) {
  e.preventDefault();
  const key = e.key;
  if (key === 'ArrowUp') {
    globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dy: -SCROLL_AMOUNT } }));
  }
  if (key === 'ArrowDown') {
    globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dy: SCROLL_AMOUNT } }));
  }
  if (key === 'ArrowLeft') {
    globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dx: -SCROLL_AMOUNT } }));
  }
  if (key === 'ArrowRight') {
    globalThis.dispatchEvent(new CustomEvent('glideit-scroll', { detail: { dx: SCROLL_AMOUNT } }));
  }
}
