"""
Graph assembler and JSON serializer.

Collects all nodes and edges from all extractors, computes depth values,
handles circular call detection, normalizes paths, and writes graph-data.json.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from glideit import __version__

logger = logging.getLogger(__name__)


class GraphAssembler:
    """Merges extractor output into a single graph and serializes it to JSON."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self._nodes: dict[str, dict[str, Any]] = {}  # id → node
        self._edges: list[dict[str, Any]] = []
        self._edge_ids: set[str] = set()

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    @property
    def nodes(self) -> list[dict[str, Any]]:
        """Expose the current list of resolved nodes (post-merge, pre-serialize)."""
        return list(self._nodes.values())

    def add(self, nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> None:
        """Add nodes and edges from a single file extraction."""
        for node in nodes:
            node_id = node["id"]
            node["file"] = self._normalize(node.get("file", ""))
            self._nodes[node_id] = node

        for edge in edges:
            edge_id = edge["id"]
            if edge_id not in self._edge_ids:
                self._edge_ids.add(edge_id)
                self._edges.append(edge)

    def serialize(
        self,
        file_count: int,
        language_counts: dict[str, int],
    ) -> str:
        """Compute depths, build JSON, and return the JSON string (does not write to disk)."""
        self._resolve_and_cleanup_graph()
        self._compute_depths()
        self._mark_circular_edges()

        graph = {
            "meta": {
                "glideit_version": __version__,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "repo_root": self._normalize(str(self.repo_root)),
                "file_count": file_count,
                "language_counts": language_counts,
            },
            "nodes": list(self._nodes.values()),
            "edges": self._edges,
        }

        return json.dumps(graph, indent=2, ensure_ascii=False)

    def _resolve_and_cleanup_graph(self) -> None:
        """
        1. Identify duplicate react component stub nodes (those generated with line=0 during imports)
           where a real definition exists, and map their IDs to the real definition's ID.
        2. Remove the stub nodes from self._nodes.
        3. Resolve all edge sources and targets, and update edge IDs.
        """
        real_definitions = self._build_real_definitions_map()
        node_id_map, nodes_to_remove = self._build_stub_map(real_definitions)

        for node_id in nodes_to_remove:
            self._nodes.pop(node_id, None)

        name_to_ids = self._build_name_to_ids_map()
        self._resolve_edges(node_id_map, name_to_ids)

    def _build_real_definitions_map(self) -> dict[tuple[str, str], str]:
        real_definitions: dict[tuple[str, str], str] = {}
        for node_id, node in self._nodes.items():
            if node.get("line", 0) > 0 and node.get("type") not in ("external_call",):
                parts = node_id.split(":", 2)
                if len(parts) == 3:
                    real_definitions[(parts[0], parts[2])] = node_id
        return real_definitions

    def _build_stub_map(
        self, real_definitions: dict[tuple[str, str], str]
    ) -> tuple[dict[str, str], set[str]]:
        node_id_map: dict[str, str] = {}
        nodes_to_remove: set[str] = set()
        for node_id, node in self._nodes.items():
            if node.get("line", 0) == 0:
                parts = node_id.split(":", 2)
                if len(parts) == 3:
                    real_id = real_definitions.get((parts[0], parts[2]))
                    if real_id:
                        node_id_map[node_id] = real_id
                        nodes_to_remove.add(node_id)
        return node_id_map, nodes_to_remove

    def _build_name_to_ids_map(self) -> dict[tuple[str, str], list[str]]:
        name_to_ids: dict[tuple[str, str], list[str]] = defaultdict(list)
        for node_id, node in self._nodes.items():
            parts = node_id.split(":", 2)
            if len(parts) == 3:
                name_to_ids[(parts[0], parts[2])].append(node_id)
        return name_to_ids

    def _resolve_edges(
        self,
        node_id_map: dict[str, str],
        name_to_ids: dict[tuple[str, str], list[str]],
    ) -> None:
        resolved_edges: list[dict[str, Any]] = []
        resolved_edge_ids: set[str] = set()

        for edge in self._edges:
            source = edge["source"]
            target = edge["target"]

            if source in node_id_map:
                source = node_id_map[source]
            if target in node_id_map:
                target = node_id_map[target]

            if target not in self._nodes:
                parts = target.split(":", 2)
                candidates = name_to_ids.get((parts[0], parts[2]), []) if len(parts) == 3 else []
                if candidates:
                    target = candidates[0]
                else:
                    logger.warning("Dangling edge target not in nodes: %s", target)

            edge["source"] = source
            edge["target"] = target
            edge["id"] = self._make_edge_id(source, target)

            if edge["id"] not in resolved_edge_ids:
                resolved_edges.append(edge)
                resolved_edge_ids.add(edge["id"])

        self._edges = resolved_edges
        self._edge_ids = resolved_edge_ids

    @staticmethod
    def _make_edge_id(source: str, target: str) -> str:
        return f"{source}--{target}"

    # ──────────────────────────────────────────
    # Depth computation  (BFS from entry points)
    # ──────────────────────────────────────────

    def _compute_depths(self) -> None:
        """
        Entry points (flask_route, react_component at root level) = depth 0.
        Direct callees = depth 1. Nested = depth 2+.
        Uses BFS; circular edges are skipped (already visited).
        """
        adj: dict[str, list[str]] = defaultdict(list)
        for edge in self._edges:
            adj[edge["source"]].append(edge["target"])

        entry_ids = self._identify_entry_points(adj)

        if not entry_ids:
            for node in self._nodes.values():
                node.setdefault("depth", 0)
            return

        depth_map = self._run_bfs(entry_ids, adj)

        for node_id, node in self._nodes.items():
            node["depth"] = depth_map.get(node_id, 0)

        for edge in self._edges:
            edge["depth"] = depth_map.get(edge["source"], 0) + 1

    def _identify_entry_points(self, adj: dict[str, list[str]]) -> list[str]:
        imported_components: set[str] = set()
        for edge in self._edges:
            if edge["type"] == "render":
                imported_components.add(edge["target"])

        entry_ids: list[str] = []
        for node_id, node in self._nodes.items():
            t = node.get("type", "")
            if t == "flask_route":
                entry_ids.append(node_id)
            elif t == "react_component" and node_id not in imported_components:
                entry_ids.append(node_id)

        incoming_edges: set[str] = set()
        for edge in self._edges:
            incoming_edges.add(edge["target"])

        for node_id, node in self._nodes.items():
            t = node.get("type", "")
            if t == "python_function":
                if node.get("name") == "main" and node_id not in entry_ids:
                    entry_ids.append(node_id)
                elif node_id not in incoming_edges and adj.get(node_id):
                    if node_id not in entry_ids:
                        entry_ids.append(node_id)

        return entry_ids

    def _run_bfs(self, entry_ids: list[str], adj: dict[str, list[str]]) -> dict[str, int]:
        depth_map: dict[str, int] = {}
        queue: deque[tuple[str, int]] = deque()
        for eid in entry_ids:
            depth_map[eid] = 0
            queue.append((eid, 0))

        while queue:
            current, d = queue.popleft()
            for neighbour in adj.get(current, []):
                if neighbour not in depth_map:
                    depth_map[neighbour] = d + 1
                    queue.append((neighbour, d + 1))

        return depth_map

    # ──────────────────────────────────────────
    # Circular / back-edge detection
    # ──────────────────────────────────────────

    def _mark_circular_edges(self) -> None:
        """
        Iterative DFS to detect back-edges (cycles). Marks them with type='circular_call'.
        Avoids Python's recursion limit issues on large codebases.
        """
        adj: dict[str, list[str]] = defaultdict(list)
        edge_lookup: dict[tuple[str, str], dict[str, Any]] = {}
        for edge in self._edges:
            adj[edge["source"]].append(edge["target"])
            edge_lookup[(edge["source"], edge["target"])] = edge

        visited: set[str] = set()
        in_stack: set[str] = set()

        for start_node in self._nodes:
            if start_node in visited:
                continue

            # Iterative DFS using explicit stack
            # Stack entries: (node, neighbour_iterator)
            stack: list[tuple[str, list[str], int]] = []
            stack.append((start_node, adj.get(start_node, []), 0))
            visited.add(start_node)
            in_stack.add(start_node)

            while stack:
                node_id, neighbours, idx = stack[-1]

                if idx < len(neighbours):
                    # Update the index for next iteration
                    stack[-1] = (node_id, neighbours, idx + 1)
                    neighbour = neighbours[idx]

                    key = (node_id, neighbour)
                    if neighbour in in_stack:
                        # Back-edge → mark as circular
                        if key in edge_lookup:
                            edge_lookup[key]["type"] = "circular_call"
                    elif neighbour not in visited:
                        visited.add(neighbour)
                        in_stack.add(neighbour)
                        stack.append((neighbour, adj.get(neighbour, []), 0))
                else:
                    # All neighbours processed, backtrack
                    in_stack.discard(node_id)
                    stack.pop()

    # Helpers

    @staticmethod
    def _normalize(path_str: str) -> str:
        """Normalize path separators to forward slashes for cross-platform consistency."""
        return path_str.replace("\\", "/")
