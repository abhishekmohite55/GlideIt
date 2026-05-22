"""
BaseExtractor — abstract interface for all language extractors.

Every language extractor must:
  1. Inherit from BaseExtractor
  2. Implement extract(file_path, source_code) → (nodes, edges)

Nodes and edges must conform to the graph JSON schema defined in codebase.md.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class BaseExtractor(ABC):
    """Abstract base for all language-specific extractors."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root

    @abstractmethod
    def extract(
        self,
        file_path: Path,
        source: bytes,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """
        Parse ``source`` from ``file_path`` and return (nodes, edges).

        Both lists must conform to the graph JSON schema:
        - nodes: list of node objects (id, name, type, file, line, ...)
        - edges: list of edge objects (id, source, target, type, ...)
        """

    # ──────────────────────────────────────────
    # Shared helpers available to all extractors
    # ──────────────────────────────────────────

    def _rel(self, file_path: Path) -> str:
        """Return file path relative to repo root, normalized to forward slashes."""
        try:
            rel = file_path.relative_to(self.repo_root)
        except ValueError:
            rel = file_path
        return rel.as_posix()

    @staticmethod
    def _make_node_id(prefix: str, rel_path: str, name: str) -> str:
        """Create a canonical node ID: `prefix:rel/path:name`."""
        return f"{prefix}:{rel_path}:{name}"

    @staticmethod
    def _make_edge_id(source: str, target: str) -> str:
        """Create a canonical edge ID: `source--target`."""
        return f"{source}--{target}"

    @staticmethod
    def _node(
        *,
        id: str,
        name: str,
        type: str,
        file: str,
        line: int,
        params: list[dict[str, Any]] | None = None,
        returns: dict[str, Any] | None = None,
        docstring: str | None = None,
        http_method: str | None = None,
        route_path: str | None = None,
        hooks: list[str] | None = None,
        props: list[dict[str, Any]] | None = None,
        depth: int = 0,
        **extra: Any,
    ) -> dict[str, Any]:
        """Build a node dict conforming to the graph schema."""
        return {
            "id": id,
            "name": name,
            "type": type,
            "file": file,
            "line": line,
            "params": params or [],
            "returns": returns or {"type_hint": None, "variable_name": None, "description": None},
            "docstring": docstring,
            "http_method": http_method,
            "route_path": route_path,
            "hooks": hooks or [],
            "props": props or [],
            "depth": depth,
            **extra,
        }

    @staticmethod
    def _edge(
        *,
        id: str,
        source: str,
        target: str,
        type: str,
        variable_name: str | None = None,
        depth: int = 1,
    ) -> dict[str, Any]:
        """Build an edge dict conforming to the graph schema."""
        return {
            "id": id,
            "source": source,
            "target": target,
            "type": type,
            "variable_name": variable_name,
            "depth": depth,
        }
