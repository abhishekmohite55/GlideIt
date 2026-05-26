"""
JSX/JS/TS/TSX extractor — uses tree-sitter-javascript and tree-sitter-typescript to parse .jsx/.js/.tsx/.ts files.

Extracts:
  - React functional components (name, file, props, hooks)
  - React class components (name, state, lifecycle methods)
  - Component-to-component render relationships (JSX element usage)
  - Hook calls: useState, useEffect, useContext, custom hooks (use*)
  - fetch() and axios calls → external_call nodes
  - Import statements
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Optional

from glideit.extractors.base import BaseExtractor

# ── tree-sitter setup ─────────────────────────────────────────────────────────
try:
    import tree_sitter_javascript as tsjs
    import tree_sitter_typescript as tstypescript
    from tree_sitter import Language, Node, Parser

    JS_LANGUAGE = Language(tsjs.language())
    TS_LANGUAGE = Language(tstypescript.language_typescript())
    TSX_LANGUAGE = Language(tstypescript.language_tsx())

    _JS_PARSER = Parser(JS_LANGUAGE)
    _TS_PARSER = Parser(TS_LANGUAGE)
    _TSX_PARSER = Parser(TSX_LANGUAGE)
    _TS_AVAILABLE = True
except Exception as _e:
    _TS_AVAILABLE = False
    print(f"[warn] tree-sitter-javascript/typescript unavailable: {_e}", file=sys.stderr)


# ── Helpers ────────────────────────────────────────────────────────────────────


def _text(node: "Node", source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _first_child_by_type(node: "Node", *types: str) -> Optional["Node"]:
    for c in node.children:
        if c.type in types:
            return c
    return None


def _children_by_type(node: "Node", *types: str) -> list["Node"]:
    return [c for c in node.children if c.type in types]


def _find_all(node: "Node", *types: str) -> list["Node"]:
    """Recursively find all descendant nodes of given types."""
    results: list["Node"] = []

    def walk(n: "Node") -> None:
        if n.type in types:
            results.append(n)
        for child in n.children:
            walk(child)

    walk(node)
    return results


# ── Component detection helpers ───────────────────────────────────────────────

_REACT_HOOKS = frozenset(
    [
        "useState",
        "useEffect",
        "useContext",
        "useReducer",
        "useCallback",
        "useMemo",
        "useRef",
        "useImperativeHandle",
        "useLayoutEffect",
        "useDebugValue",
        "useId",
        "useTransition",
        "useDeferredValue",
    ]
)

_LIFECYCLE_METHODS = frozenset(
    [
        "componentDidMount",
        "componentDidUpdate",
        "componentWillUnmount",
        "componentWillMount",
        "shouldComponentUpdate",
        "render",
        "componentDidCatch",
        "getDerivedStateFromProps",
    ]
)


def _is_component_name(name: str) -> bool:
    """React component names start with uppercase."""
    return bool(name) and name[0].isupper()


def _collect_hooks(body_node: "Node", source: bytes) -> list[str]:
    """Collect all hook calls (use* pattern) within a function body."""
    hooks: list[str] = []
    seen: set[str] = set()
    for call in _find_all(body_node, "call_expression"):
        func = call.child_by_field_name("function")
        if func is None:
            continue
        name = _text(func, source).strip()
        # Simple hook call: useState(...)
        if (
            name in _REACT_HOOKS or (name.startswith("use") and name[3:4].isupper())
        ) and name not in seen:
            hooks.append(name)
            seen.add(name)
    return hooks


def _collect_jsx_children(body_node: "Node", source: bytes) -> list[str]:
    """Collect all JSX element names used in a component body (render relationships)."""
    used: list[str] = []
    seen: set[str] = set()
    for elem in _find_all(body_node, "jsx_opening_element", "jsx_self_closing_element"):
        name_node = elem.child_by_field_name("name")
        if name_node is None:
            # Sometimes it's the first named child
            for c in elem.children:
                if c.type in ("identifier", "member_expression"):
                    name_node = c
                    break
        if name_node:
            name = _text(name_node, source).strip()
            if _is_component_name(name) and name not in seen:
                used.append(name)
                seen.add(name)
    return used


def _extract_url_and_method(
    call: "Node", source: bytes, func_name: str, is_fetch: bool, is_axios: bool
) -> tuple[Optional[str], str]:
    """Extract URL and HTTP method from a fetch/axios call expression."""
    args_node: Optional["Node"] = call.child_by_field_name("arguments")
    url: Optional[str] = None
    method = "GET"
    if args_node:
        str_args = _find_all(args_node, "string")
        if str_args:
            url = _text(str_args[0], source).strip("\"'`").strip()
        if is_axios and "." in func_name:
            method = func_name.split(".")[-1].upper()
    return url, method


def _collect_fetch_axios(body_node: "Node", source: bytes) -> list[dict[str, Any]]:
    """Collect fetch() and axios calls within a function body."""
    external_calls: list[dict[str, Any]] = []
    for call in _find_all(body_node, "call_expression"):
        func = call.child_by_field_name("function")
        if func is None:
            continue
        func_name = _text(func, source).strip()
        is_fetch = func_name == "fetch"
        is_axios = func_name.startswith("axios")
        if not (is_fetch or is_axios):
            continue
        url, method = _extract_url_and_method(call, source, func_name, is_fetch, is_axios)
        external_calls.append({"name": func_name, "url": url, "method": method})
    return external_calls


def _extract_props_from_object_pattern(pattern_node: "Node", source: bytes) -> list[dict[str, Any]]:
    """Extract prop names from a destructured object pattern."""
    props: list[dict[str, Any]] = []
    for child in pattern_node.children:
        if child.type == "shorthand_property_identifier_pattern":
            props.append({"name": _text(child, source), "type_hint": None})
        elif child.type == "pair_pattern":
            key = child.child_by_field_name("key")
            if key:
                props.append({"name": _text(key, source), "type_hint": None})
    return props


def _collect_props_from_params(params_node: "Node", source: bytes) -> list[dict[str, Any]]:
    """Extract prop names from function parameters (destructuring or single props object)."""
    props: list[dict[str, Any]] = []
    if params_node is None:
        return props

    for child in params_node.children:
        if child.type == "object_pattern":
            props.extend(_extract_props_from_object_pattern(child, source))
        elif child.type == "identifier":
            name = _text(child, source)
            if name not in ("props",):
                props.append({"name": name, "type_hint": None})

    return props


# ── JSX Extractor ─────────────────────────────────────────────────────────────


class JSXExtractor(BaseExtractor):
    """Extract nodes and edges from JSX/JS/TSX source files using tree-sitter."""

    def extract(
        self,
        file_path: Path,
        source: bytes,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        if not _TS_AVAILABLE:
            return [], []

        try:
            # Select parser based on file extension
            ext = file_path.suffix.lower()
            if ext == ".ts":
                tree = _TS_PARSER.parse(source)
            elif ext == ".tsx":
                tree = _TSX_PARSER.parse(source)
            else:
                tree = _JS_PARSER.parse(source)

            rel = self._rel(file_path)
            nodes: list[dict[str, Any]] = []
            edges: list[dict[str, Any]] = []
            seen_node_ids: set[str] = set()  # O(1) duplicate tracking

            self._walk_program(tree.root_node, source, rel, nodes, edges, seen_node_ids)
            return nodes, edges
        except Exception as e:
            print(f"[GlideIt WARNING] Skipping {file_path}: {e}")
            return [], []

    # ──────────────────────────────────────────────────────────────
    # Module-level walker
    # ──────────────────────────────────────────────────────────────

    def _walk_program(
        self,
        root: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        for child in root.children:
            if child.type in (
                "function_declaration",
                "function",
                "lexical_declaration",
                "variable_declaration",
                "export_statement",
            ):
                self._handle_top_level(child, source, rel, nodes, edges, seen_node_ids)
            elif child.type == "class_declaration":
                self._handle_class(child, source, rel, nodes, edges, seen_node_ids)
            elif child.type == "expression_statement":
                # Arrow function assigned to const at top level is caught via lexical_declaration
                pass

    # ──────────────────────────────────────────────────────────────
    # Top-level declarations
    # ──────────────────────────────────────────────────────────────

    def _handle_top_level(
        self,
        node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        """Handle function declarations, arrow functions, and export statements."""
        if node.type == "export_statement":
            self._handle_export(node, source, rel, nodes, edges, seen_node_ids)
            return
        if node.type == "function_declaration":
            self._handle_function_decl(node, source, rel, nodes, edges, seen_node_ids)
            return
        if node.type in ("lexical_declaration", "variable_declaration"):
            self._handle_variable_decl(node, source, rel, nodes, edges, seen_node_ids)

    def _handle_export(
        self,
        node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        for child in node.children:
            if child.type in (
                "function_declaration",
                "lexical_declaration",
                "variable_declaration",
                "class_declaration",
            ):
                self._handle_top_level(child, source, rel, nodes, edges, seen_node_ids)
                return

    def _handle_function_decl(
        self,
        node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        name_node = node.child_by_field_name("name")
        if not name_node:
            return
        name = _text(name_node, source)
        if not _is_component_name(name):
            return
        body = node.child_by_field_name("body")
        params = node.child_by_field_name("parameters")
        source_chunk = source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")
        self._register_component(name, node, params, body, source, rel, nodes, edges, seen_node_ids, source_chunk=source_chunk)

    def _handle_variable_decl(
        self,
        node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        for decl in _children_by_type(node, "variable_declarator"):
            name_node = decl.child_by_field_name("name")
            value_node = decl.child_by_field_name("value")
            if not name_node or not value_node:
                continue
            name = _text(name_node, source)
            if not _is_component_name(name):
                continue
            if value_node.type not in ("arrow_function", "function", "function_expression"):
                continue
            params = value_node.child_by_field_name("parameters")
            body = value_node.child_by_field_name("body")
            source_chunk = source[value_node.start_byte:value_node.end_byte].decode("utf-8", errors="replace")
            self._register_component(name, node, params, body, source, rel, nodes, edges, seen_node_ids, source_chunk=source_chunk)

    # ──────────────────────────────────────────────────────────────
    # Component registration
    # ──────────────────────────────────────────────────────────────

    def _register_component(
        self,
        name: str,
        def_node: "Node",
        params_node: Optional["Node"],
        body_node: Optional["Node"],
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
        source_chunk: Optional[str] = None,
    ) -> None:
        line = def_node.start_point[0] + 1
        node_id = self._make_node_id("jsx", rel, name)

        if node_id not in seen_node_ids:
            props = _collect_props_from_params(params_node, source) if params_node else []
            hooks = _collect_hooks(body_node, source) if body_node else []
            jsx_children = _collect_jsx_children(body_node, source) if body_node else []
            fetch_calls = _collect_fetch_axios(body_node, source) if body_node else []

            node_kwargs = dict(
                id=node_id,
                name=name,
                type="react_component",
                file=rel,
                line=line,
                props=props,
                hooks=hooks,
                docstring="No description available.",
                depth=0,
            )
            if source_chunk is not None:
                node_kwargs["source_chunk"] = source_chunk
            node = self._node(**node_kwargs)
            nodes.append(node)
            seen_node_ids.add(node_id)
        else:
            jsx_children = _collect_jsx_children(body_node, source) if body_node else []
            fetch_calls = _collect_fetch_axios(body_node, source) if body_node else []

        self._create_render_edges(node_id, rel, jsx_children, nodes, edges, seen_node_ids)
        self._create_fetch_edges(node_id, rel, fetch_calls, line, nodes, edges, seen_node_ids)

    def _create_render_edges(
        self,
        node_id: str,
        rel: str,
        jsx_children: list[str],
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        seen_children: set[str] = set()
        for child_component in jsx_children:
            if child_component in seen_children:
                continue
            seen_children.add(child_component)
            target_id = self._make_node_id("jsx", rel, child_component)
            if target_id not in seen_node_ids:
                nodes.append(
                    self._node(
                        id=target_id,
                        name=child_component,
                        type="react_component",
                        file=rel,
                        line=0,
                        depth=1,
                    )
                )
                seen_node_ids.add(target_id)
            edge_id = self._make_edge_id(node_id, target_id)
            edges.append(
                self._edge(
                    id=edge_id,
                    source=node_id,
                    target=target_id,
                    type="render",
                )
            )

    def _create_fetch_edges(
        self,
        node_id: str,
        rel: str,
        fetch_calls: list[dict],
        line: int,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        for fc in fetch_calls:
            ext_name = f"{fc['name']}:{fc.get('url') or 'dynamic'}"
            ext_id = self._make_node_id("ext", rel, ext_name)
            if ext_id not in seen_node_ids:
                nodes.append(
                    self._node(
                        id=ext_id,
                        name=fc["name"],
                        type="external_call",
                        file=rel,
                        line=line,
                        route_path=fc.get("url"),
                        http_method=fc.get("method", "GET"),
                        depth=2,
                    )
                )
                seen_node_ids.add(ext_id)
            edge_id = self._make_edge_id(node_id, ext_id)
            edges.append(
                self._edge(
                    id=edge_id,
                    source=node_id,
                    target=ext_id,
                    type="call",
                )
            )

    # ──────────────────────────────────────────────────────────────
    # Class component
    # ──────────────────────────────────────────────────────────────

    def _handle_class(
        self,
        class_node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        seen_node_ids: set[str],
    ) -> None:
        name_node = class_node.child_by_field_name("name")
        if not name_node:
            return
        name = _text(name_node, source)
        if not _is_component_name(name):
            return

        line = class_node.start_point[0] + 1
        node_id = self._make_node_id("jsx", rel, name)
        jsx_children, lifecycle, fetch_calls = self._collect_class_body(class_node, source)
        source_chunk = source[class_node.start_byte:class_node.end_byte].decode("utf-8", errors="replace")

        if node_id not in seen_node_ids:
            node = self._node(
                id=node_id,
                name=name,
                type="react_component",
                file=rel,
                line=line,
                hooks=lifecycle,
                docstring="No description available.",
                depth=0,
                source_chunk=source_chunk,
            )
            node["lifecycle_methods"] = lifecycle
            nodes.append(node)
            seen_node_ids.add(node_id)

        self._create_render_edges(node_id, rel, jsx_children, nodes, edges, seen_node_ids)
        self._create_fetch_edges(node_id, rel, fetch_calls, line, nodes, edges, seen_node_ids)

    def _collect_class_body(
        self,
        class_node: "Node",
        source: bytes,
    ) -> tuple[list[str], list[str], list[dict]]:
        body = class_node.child_by_field_name("body")
        jsx_children: list[str] = []
        lifecycle: list[str] = []
        fetch_calls: list[dict] = []
        if body:
            for method in _find_all(body, "method_definition"):
                mname_node = method.child_by_field_name("name")
                if not mname_node:
                    continue
                mname = _text(mname_node, source)
                if mname in _LIFECYCLE_METHODS:
                    lifecycle.append(mname)
                mbody = method.child_by_field_name("body")
                if mname == "render" and mbody:
                    jsx_children.extend(_collect_jsx_children(mbody, source))
                if mbody:
                    fetch_calls.extend(_collect_fetch_axios(mbody, source))
        return jsx_children, lifecycle, fetch_calls
