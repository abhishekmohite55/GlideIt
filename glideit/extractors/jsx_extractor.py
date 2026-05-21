"""
JSX/JS/TS extractor — uses tree-sitter-javascript to parse .jsx/.js/.tsx/.ts files.

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
from typing import Any, Dict, List, Optional, Set, Tuple

from glideit.extractors.base import BaseExtractor

# ── tree-sitter setup ─────────────────────────────────────────────────────────
try:
    import tree_sitter_javascript as tsjs
    from tree_sitter import Language, Node, Parser

    JS_LANGUAGE = Language(tsjs.language())
    _PARSER = Parser(JS_LANGUAGE)
    _TS_AVAILABLE = True
except Exception as _e:
    _TS_AVAILABLE = False
    print(f"[warn] tree-sitter-javascript unavailable: {_e}", file=sys.stderr)


# ── Helpers ────────────────────────────────────────────────────────────────────


def _text(node: "Node", source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _first_child_by_type(node: "Node", *types: str) -> Optional["Node"]:
    for c in node.children:
        if c.type in types:
            return c
    return None


def _children_by_type(node: "Node", *types: str) -> List["Node"]:
    return [c for c in node.children if c.type in types]


def _find_all(node: "Node", *types: str) -> List["Node"]:
    """Recursively find all descendant nodes of given types."""
    results: List["Node"] = []

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


def _collect_hooks(body_node: "Node", source: bytes) -> List[str]:
    """Collect all hook calls (use* pattern) within a function body."""
    hooks: List[str] = []
    seen: Set[str] = set()
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


def _collect_jsx_children(body_node: "Node", source: bytes) -> List[str]:
    """Collect all JSX element names used in a component body (render relationships)."""
    used: List[str] = []
    seen: Set[str] = set()
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


def _collect_fetch_axios(body_node: "Node", source: bytes) -> List[Dict[str, Any]]:
    """Collect fetch() and axios calls within a function body."""
    external_calls: List[Dict[str, Any]] = []
    for call in _find_all(body_node, "call_expression"):
        func = call.child_by_field_name("function")
        if func is None:
            continue
        func_name = _text(func, source).strip()
        is_fetch = func_name == "fetch"
        is_axios = func_name.startswith("axios")
        if not (is_fetch or is_axios):
            continue

        # Try to extract URL from first argument
        args_node = call.child_by_field_name("arguments")
        url: Optional[str] = None
        method = "GET"  # default
        if args_node:
            str_args = _find_all(args_node, "string")
            if str_args:
                url = _text(str_args[0], source).strip("\"'`").strip()
            # axios.post / axios.get / etc.
            if is_axios and "." in func_name:
                method = func_name.split(".")[-1].upper()

        external_calls.append({"name": func_name, "url": url, "method": method})

    return external_calls


def _collect_props_from_params(params_node: "Node", source: bytes) -> List[Dict[str, Any]]:
    """Extract prop names from function parameters (destructuring or single props object)."""
    props: List[Dict[str, Any]] = []
    if params_node is None:
        return props

    for child in params_node.children:
        if child.type == "object_pattern":
            # Destructured props: ({ name, age })
            for prop_child in child.children:
                if prop_child.type == "shorthand_property_identifier_pattern":
                    props.append({"name": _text(prop_child, source), "type_hint": None})
                elif prop_child.type == "pair_pattern":
                    key = prop_child.child_by_field_name("key")
                    if key:
                        props.append({"name": _text(key, source), "type_hint": None})
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
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if not _TS_AVAILABLE:
            return [], []

        try:
            try:
                tree = _PARSER.parse(source)
            except Exception as exc:
                raise RuntimeError(f"tree-sitter parse error: {exc}") from exc

            rel = self._rel(file_path)
            nodes: List[Dict[str, Any]] = []
            edges: List[Dict[str, Any]] = []

            self._walk_program(tree.root_node, source, rel, nodes, edges)
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
        nodes: List,
        edges: List,
    ) -> None:
        for child in root.children:
            if child.type in ("import_statement", "import_declaration"):
                self._handle_import(child, source, rel, nodes, edges)
            elif child.type in (
                "function_declaration",
                "function",
                "lexical_declaration",
                "variable_declaration",
                "export_statement",
            ):
                self._handle_top_level(child, source, rel, nodes, edges)
            elif child.type == "class_declaration":
                self._handle_class(child, source, rel, nodes, edges)
            elif child.type == "expression_statement":
                # Arrow function assigned to const at top level is caught via lexical_declaration
                pass

    # ──────────────────────────────────────────────────────────────
    # Import handler
    # ──────────────────────────────────────────────────────────────

    def _handle_import(
        self,
        node: "Node",
        source: bytes,
        rel: str,
        nodes: List,
        edges: List,
    ) -> None:
        # We don't create import nodes; just used to resolve component names
        pass

    # ──────────────────────────────────────────────────────────────
    # Top-level declarations
    # ──────────────────────────────────────────────────────────────

    def _handle_top_level(
        self,
        node: "Node",
        source: bytes,
        rel: str,
        nodes: List,
        edges: List,
    ) -> None:
        """Handle function declarations, arrow functions, and export statements."""
        # Unwrap export
        if node.type == "export_statement":
            for child in node.children:
                if child.type in (
                    "function_declaration",
                    "lexical_declaration",
                    "variable_declaration",
                    "class_declaration",
                ):
                    self._handle_top_level(child, source, rel, nodes, edges)
                    return

        # Function declaration
        if node.type == "function_declaration":
            name_node = node.child_by_field_name("name")
            if name_node:
                name = _text(name_node, source)
                if _is_component_name(name):
                    body = node.child_by_field_name("body")
                    params = node.child_by_field_name("parameters")
                    self._register_component(name, node, params, body, source, rel, nodes, edges)
            return

        # const Foo = (...) => ...  or  const Foo = function(...) { ... }
        if node.type in ("lexical_declaration", "variable_declaration"):
            for decl in _children_by_type(node, "variable_declarator"):
                name_node = decl.child_by_field_name("name")
                value_node = decl.child_by_field_name("value")
                if name_node and value_node:
                    name = _text(name_node, source)
                    if _is_component_name(name) and value_node.type in (
                        "arrow_function",
                        "function",
                        "function_expression",
                    ):
                        params = value_node.child_by_field_name("parameters")
                        body = value_node.child_by_field_name("body")
                        self._register_component(
                            name, node, params, body, source, rel, nodes, edges
                        )

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
        nodes: List,
        edges: List,
    ) -> None:
        line = def_node.start_point[0] + 1
        node_id = self._make_node_id("jsx", rel, name)

        props = _collect_props_from_params(params_node, source) if params_node else []
        hooks = _collect_hooks(body_node, source) if body_node else []
        jsx_children = _collect_jsx_children(body_node, source) if body_node else []
        fetch_calls = _collect_fetch_axios(body_node, source) if body_node else []

        node = self._node(
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
        nodes.append(node)

        # ── Render relationships ────────────────
        for child_component in jsx_children:
            target_id = self._make_node_id("jsx", rel, child_component)
            # Stub target if not yet defined (may be in another file)
            if not any(n["id"] == target_id for n in nodes):
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
            edge_id = self._make_edge_id(node_id, target_id)
            edges.append(
                self._edge(
                    id=edge_id,
                    source=node_id,
                    target=target_id,
                    type="render",
                )
            )

        # ── External fetch/axios calls ──────────
        for fc in fetch_calls:
            ext_name = f"{fc['name']}:{fc.get('url') or 'dynamic'}"
            ext_id = self._make_node_id("ext", rel, ext_name)
            if not any(n["id"] == ext_id for n in nodes):
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
        nodes: List,
        edges: List,
    ) -> None:
        name_node = class_node.child_by_field_name("name")
        if not name_node:
            return
        name = _text(name_node, source)
        if not _is_component_name(name):
            return

        line = class_node.start_point[0] + 1
        node_id = self._make_node_id("jsx", rel, name)

        body = class_node.child_by_field_name("body")
        jsx_children: List[str] = []
        lifecycle: List[str] = []
        fetch_calls: List[Dict] = []

        if body:
            for method in _find_all(body, "method_definition"):
                mname_node = method.child_by_field_name("name")
                if mname_node:
                    mname = _text(mname_node, source)
                    if mname in _LIFECYCLE_METHODS:
                        lifecycle.append(mname)
                    mbody = method.child_by_field_name("body")
                    if mname == "render" and mbody:
                        jsx_children.extend(_collect_jsx_children(mbody, source))
                    if mbody:
                        fetch_calls.extend(_collect_fetch_axios(mbody, source))

        node = self._node(
            id=node_id,
            name=name,
            type="react_component",
            file=rel,
            line=line,
            hooks=lifecycle,
            docstring="No description available.",
            depth=0,
        )
        node["lifecycle_methods"] = lifecycle
        nodes.append(node)

        # Render relationships
        for child_name in set(jsx_children):
            if child_name == name:
                continue
            target_id = self._make_node_id("jsx", rel, child_name)
            if not any(n["id"] == target_id for n in nodes):
                nodes.append(
                    self._node(
                        id=target_id,
                        name=child_name,
                        type="react_component",
                        file=rel,
                        line=0,
                        depth=1,
                    )
                )
            edge_id = self._make_edge_id(node_id, target_id)
            edges.append(
                self._edge(
                    id=edge_id,
                    source=node_id,
                    target=target_id,
                    type="render",
                )
            )
