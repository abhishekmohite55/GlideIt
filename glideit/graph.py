"""
Graph assembler and JSON serializer.

Collects all nodes and edges from all extractors, computes depth values,
handles circular call detection, normalizes paths, and writes graph-data.json.
"""

from __future__ import annotations

import json
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from glideit import __version__


class GraphAssembler:
    """Merges extractor output into a single graph and serializes it to JSON."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self._nodes: Dict[str, Dict[str, Any]] = {}  # id → node
        self._edges: List[Dict[str, Any]] = []
        self._edge_ids: Set[str] = set()

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    def add(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> None:
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
        path: Path,
        file_count: int,
        language_counts: Dict[str, int],
    ) -> str:
        """Compute depths, build JSON, write to disk, and return the JSON string."""
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

        json_str = json.dumps(graph, indent=2, ensure_ascii=False)
        path.write_text(json_str, encoding="utf-8")
        return json_str

    def _resolve_and_cleanup_graph(self) -> None:
        """
        1. Identify duplicate react component stub nodes (those generated with line=0 during imports)
           where a real definition exists, and map their IDs to the real definition's ID.
        2. Remove the stub nodes from self._nodes.
        3. Resolve all edge sources and targets, and update edge IDs.
        """
        # Map of (prefix, name) -> real_node_id
        real_definitions: Dict[Tuple[str, str], str] = {}
        for node_id, node in self._nodes.items():
            if node.get("line", 0) > 0 and node.get("type") not in ("external_call",):
                parts = node_id.split(":", 2)
                if len(parts) == 3:
                    prefix, _, name = parts
                    real_definitions[(prefix, name)] = node_id

        # Map of stub/unresolved node ID -> real node ID
        node_id_map: Dict[str, str] = {}
        nodes_to_remove: Set[str] = set()

        for node_id, node in self._nodes.items():
            if node.get("line", 0) == 0:
                parts = node_id.split(":", 2)
                if len(parts) == 3:
                    prefix, _, name = parts
                    real_id = real_definitions.get((prefix, name))
                    if real_id:
                        node_id_map[node_id] = real_id
                        nodes_to_remove.add(node_id)

        # Remove duplicate stub nodes from graph
        for node_id in nodes_to_remove:
            self._nodes.pop(node_id, None)

        # Build name_to_ids for remaining nodes to resolve other unmapped edges
        name_to_ids: Dict[Tuple[str, str], List[str]] = defaultdict(list)
        for node_id, node in self._nodes.items():
            parts = node_id.split(":", 2)
            if len(parts) == 3:
                prefix, _, name = parts
                name_to_ids[(prefix, name)].append(node_id)

        # Update edges
        resolved_edges: List[Dict[str, Any]] = []
        resolved_edge_ids: Set[str] = set()

        for edge in self._edges:
            source = edge["source"]
            target = edge["target"]

            # Apply stub mapping
            if source in node_id_map:
                source = node_id_map[source]
            if target in node_id_map:
                target = node_id_map[target]

            # General name-based resolution for missing target nodes
            if target not in self._nodes:
                parts = target.split(":", 2)
                if len(parts) == 3:
                    prefix, _, name = parts
                    candidates = name_to_ids.get((prefix, name), [])
                else:
                    candidates = []
                if candidates:
                    target = candidates[0]

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
        # Build adjacency map: source → [targets]
        adj: Dict[str, List[str]] = defaultdict(list)
        for edge in self._edges:
            adj[edge["source"]].append(edge["target"])

        # Identify entry points
        # flask_route nodes are always entry points
        # react_component nodes that are NOT imported by any other component are root-level
        imported_components: Set[str] = set()
        for edge in self._edges:
            if edge["type"] == "render":
                imported_components.add(edge["target"])

        entry_ids: List[str] = []
        for node_id, node in self._nodes.items():
            t = node.get("type", "")
            if t == "flask_route":
                entry_ids.append(node_id)
            elif t == "react_component" and node_id not in imported_components:
                entry_ids.append(node_id)

        if not entry_ids:
            # Fall back: depth 0 for everyone (no Flask/React entry points found)
            for node in self._nodes.values():
                node.setdefault("depth", 0)
            return

        # BFS
        depth_map: Dict[str, int] = {}
        queue: deque[Tuple[str, int]] = deque()
        for eid in entry_ids:
            depth_map[eid] = 0
            queue.append((eid, 0))

        while queue:
            current, d = queue.popleft()
            for neighbour in adj.get(current, []):
                if neighbour not in depth_map:
                    depth_map[neighbour] = d + 1
                    queue.append((neighbour, d + 1))

        # Assign depths; unreachable nodes default to 0
        for node_id, node in self._nodes.items():
            node["depth"] = depth_map.get(node_id, 0)

        # Update edge depths to match source node depth + 1
        for edge in self._edges:
            src_depth = depth_map.get(edge["source"], 0)
            edge["depth"] = src_depth + 1

    # ──────────────────────────────────────────
    # Circular / back-edge detection
    # ──────────────────────────────────────────

    def _mark_circular_edges(self) -> None:
        """
        DFS to detect back-edges (cycles). Marks them with type='circular_call'.
        """
        adj: Dict[str, List[str]] = defaultdict(list)
        edge_lookup: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for edge in self._edges:
            adj[edge["source"]].append(edge["target"])
            edge_lookup[(edge["source"], edge["target"])] = edge

        visited: Set[str] = set()
        in_stack: Set[str] = set()

        def dfs(node_id: str) -> None:
            visited.add(node_id)
            in_stack.add(node_id)
            for neighbour in adj.get(node_id, []):
                key = (node_id, neighbour)
                if neighbour in in_stack:
                    # Back-edge → mark as circular
                    if key in edge_lookup:
                        edge_lookup[key]["type"] = "circular_call"
                elif neighbour not in visited:
                    dfs(neighbour)
            in_stack.discard(node_id)

        for node_id in list(self._nodes.keys()):
            if node_id not in visited:
                dfs(node_id)

    # ──────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────

    @staticmethod
    def _normalize(path_str: str) -> str:
        """Normalize path separators to forward slashes for cross-platform consistency."""
        return path_str.replace("\\", "/")
