"""
Walker — directory traversal with .gitignore support.

Recursively walks the repo root, applies pathspec gitignore rules,
and returns separate lists of Python and JSX/JS/TSX files.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Tuple

try:
    import pathspec
except ImportError:
    pathspec = None  # type: ignore[assignment]

# Built-in ignore list used when no .gitignore is found
_BUILTIN_IGNORES = [
    "node_modules/",
    "__pycache__/",
    ".git/",
    "dist/",
    "build/",
    ".venv/",
    "venv/",
    "*.pyc",
    "*.pyo",
    ".DS_Store",
    "glideit-out/",
    ".mypy_cache/",
    ".pytest_cache/",
    "*.egg-info/",
]

# Supported file extensions
_PYTHON_EXTS = {".py"}
_JSX_EXTS = {".jsx", ".js", ".tsx", ".ts"}


class Walker:
    """Recursively walks a directory, honouring .gitignore rules."""

    def __init__(self, root: Path, exclude_patterns: List[str] | None = None) -> None:
        self.root = root
        self.exclude_patterns = exclude_patterns or []
        self._spec = self._load_spec()

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    def collect(self) -> Tuple[List[Path], List[Path]]:
        """Return (py_files, jsx_files) — both as absolute Paths."""
        py_files: List[Path] = []
        jsx_files: List[Path] = []

        for path in self._walk(self.root):
            ext = path.suffix.lower()
            if ext in _PYTHON_EXTS:
                py_files.append(path)
            elif ext in _JSX_EXTS:
                jsx_files.append(path)

        return py_files, jsx_files

    # ──────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────

    def _load_spec(self):
        """Load pathspec from .gitignore or fall back to built-in list."""
        if pathspec is None:
            print(
                "[warn] pathspec not installed; using built-in ignore list.",
                file=sys.stderr,
            )
            return None

        gitignore = self.root / ".gitignore"
        try:
            if gitignore.exists():
                patterns = gitignore.read_text(encoding="utf-8", errors="ignore").splitlines()
            else:
                print(
                    "[notice] No .gitignore found; using built-in ignore list.",
                    file=sys.stderr,
                )
                patterns = list(_BUILTIN_IGNORES)
        except Exception as e:
            print(f"[GlideIt WARNING] Skipping .gitignore: {e}")
            patterns = list(_BUILTIN_IGNORES)

        # Merge custom exclude patterns
        patterns.extend(self.exclude_patterns)

        return pathspec.PathSpec.from_lines("gitwildmatch", patterns)

    def _is_ignored(self, path: Path) -> bool:
        """Return True if this path matches the ignore spec."""
        if self._spec is None:
            # Fallback: manually check built-in ignore patterns
            rel = path.relative_to(self.root)
            for part in rel.parts:
                if part in (
                    "node_modules",
                    "__pycache__",
                    ".git",
                    "dist",
                    "build",
                    ".venv",
                    "venv",
                    "glideit-out",
                    ".mypy_cache",
                    ".pytest_cache",
                ):
                    return True
            return False

        rel = path.relative_to(self.root).as_posix()
        if path.is_dir():
            rel = f"{rel}/"
        return self._spec.match_file(rel)

    def _walk(self, directory: Path):
        """Yield all non-ignored files under directory."""
        try:
            entries = sorted(directory.iterdir())
        except PermissionError:
            return

        for entry in entries:
            if self._is_ignored(entry):
                continue
            if entry.is_symlink():
                continue
            if entry.is_dir():
                yield from self._walk(entry)
            elif entry.is_file():
                yield entry
