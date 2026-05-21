"""
Python extractor — uses tree-sitter-python to parse .py files.

Extracts:
  - Function definitions (name, file, line, params+types, return type, docstring)
  - Function calls within each function body
  - Class definitions (name, methods, parent class)
  - Import statements
  - Flask route decorators (@app.route / @blueprint.route)
  - Variable assignments at function scope
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from glideit.extractors.base import BaseExtractor

# ── tree-sitter setup ─────────────────────────────────────────────────────────
try:
    import tree_sitter_python as tspython
    from tree_sitter import Language, Node, Parser

    PY_LANGUAGE = Language(tspython.language())
    _PARSER = Parser(PY_LANGUAGE)
    _TS_AVAILABLE = True
except Exception as _e:
    _TS_AVAILABLE = False
    print(f"[warn] tree-sitter-python unavailable: {_e}", file=sys.stderr)


# ── Helpers ────────────────────────────────────────────────────────────────────


def _text(node: "Node", source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def _child_by_field(node: "Node", field: str) -> Optional["Node"]:
    return node.child_by_field_name(field)


def _children_by_type(node: "Node", *types: str) -> List["Node"]:
    return [c for c in node.children if c.type in types]


def _first_child_by_type(node: "Node", *types: str) -> Optional["Node"]:
    for c in node.children:
        if c.type in types:
            return c
    return None


def _extract_docstring(body_node: "Node", source: bytes) -> Optional[str]:
    """Extract the first string literal in a function/class body as docstring."""
    if body_node is None:
        return None
    for child in body_node.children:
        if child.type == "expression_statement":
            for inner in child.children:
                if inner.type in ("string", "concatenated_string"):
                    raw = _text(inner, source).strip()
                    # Strip triple or single quotes
                    for q in ('"""', "'''", '"', "'"):
                        if raw.startswith(q) and raw.endswith(q) and len(raw) > 2 * len(q):
                            return raw[len(q) : -len(q)].strip()
                    return raw
        break  # docstring must be first statement
    return None


def _extract_params(parameters_node: "Node", source: bytes) -> List[Dict[str, Any]]:
    """Parse a parameters node into list of {name, type_hint, default_value}."""
    params = []
    if parameters_node is None:
        return params

    for child in parameters_node.children:
        if child.type in ("identifier",):
            params.append({"name": _text(child, source), "type_hint": None, "default_value": None})
        elif child.type == "typed_parameter":
            name_node = _first_child_by_type(child, "identifier")
            type_node = child.child_by_field_name("type")
            params.append(
                {
                    "name": _text(name_node, source) if name_node else "?",
                    "type_hint": _text(type_node, source) if type_node else None,
                    "default_value": None,
                }
            )
        elif child.type == "default_parameter":
            name_node = child.child_by_field_name("name")
            value_node = child.child_by_field_name("value")
            params.append(
                {
                    "name": _text(name_node, source) if name_node else "?",
                    "type_hint": None,
                    "default_value": _text(value_node, source) if value_node else None,
                }
            )
        elif child.type == "typed_default_parameter":
            name_node = child.child_by_field_name("name")
            type_node = child.child_by_field_name("type")
            value_node = child.child_by_field_name("value")
            params.append(
                {
                    "name": _text(name_node, source) if name_node else "?",
                    "type_hint": _text(type_node, source) if type_node else None,
                    "default_value": _text(value_node, source) if value_node else None,
                }
            )
        elif child.type in ("list_splat_pattern", "dictionary_splat_pattern"):
            inner = _first_child_by_type(child, "identifier")
            prefix = "*" if child.type == "list_splat_pattern" else "**"
            if inner:
                params.append(
                    {
                        "name": prefix + _text(inner, source),
                        "type_hint": None,
                        "default_value": None,
                    }
                )

    # Filter out 'self' and 'cls'
    params = [p for p in params if p["name"] not in ("self", "cls")]
    return params


def _extract_return_type(func_node: "Node", source: bytes) -> Optional[str]:
    """Get return type annotation from function definition."""
    return_type = func_node.child_by_field_name("return_type")
    if return_type:
        # Strip leading '->'
        t = _text(return_type, source).strip().lstrip("-").lstrip(">").strip()
        return t or None
    return None


# ── Flask route detection ──────────────────────────────────────────────────────


def _is_flask_route_decorator(
    decorator_node: "Node", source: bytes
) -> Tuple[Optional[str], Optional[str]]:
    """
    Detect Flask route decorators on app or blueprints (name-agnostic).
    Matches @<any>.route, @<any>.get, @<any>.post, @<any>.put, @<any>.delete, @<any>.patch.
    Returns (http_method, route_path) or (None, None).
    """
    call_node = _first_child_by_type(decorator_node, "call")
    if call_node is None:
        for child in decorator_node.children:
            if child.type == "call":
                call_node = child
                break
    if call_node is None:
        return None, None

    func_node = call_node.child_by_field_name("function")
    if func_node is None:
        return None, None

    method_name = None
    if func_node.type == "attribute":
        attr_node = func_node.child_by_field_name("attribute")
        if attr_node:
            method_name = _text(attr_node, source)
    elif func_node.type == "identifier":
        method_name = _text(func_node, source)

    if method_name not in ("route", "get", "post", "put", "delete", "patch"):
        return None, None

    # Determine default method based on decorator name
    if method_name == "route":
        default_method = "GET"
    else:
        default_method = method_name.upper()

    # Find the route path and methods keyword argument
    route_path = None
    http_method = default_method

    args_node = _first_child_by_type(call_node, "argument_list")
    if args_node:
        # First argument is typically the path
        for arg in args_node.children:
            if arg.type == "string":
                raw = _text(arg, source).strip()
                # strip outer quotes
                for q in ('"""', "'''", '"', "'"):
                    if raw.startswith(q) and raw.endswith(q) and len(raw) >= 2 * len(q):
                        raw = raw[len(q) : -len(q)]
                        break
                route_path = raw
                break
            elif arg.type == "keyword_argument":
                kw_name = arg.child_by_field_name("name")
                if kw_name and _text(kw_name, source) == "rule":
                    kw_val = arg.child_by_field_name("value")
                    if kw_val and kw_val.type == "string":
                        raw = _text(kw_val, source).strip()
                        for q in ('"""', "'''", '"', "'"):
                            if raw.startswith(q) and raw.endswith(q) and len(raw) >= 2 * len(q):
                                raw = raw[len(q) : -len(q)]
                                break
                        route_path = raw

        # Look for methods keyword argument: methods=['GET', 'POST']
        for arg in args_node.children:
            if arg.type == "keyword_argument":
                name_node = arg.child_by_field_name("name")
                if name_node and _text(name_node, source) == "methods":
                    val_node = arg.child_by_field_name("value")
                    if val_node:
                        # Extract methods list
                        methods_found = []
                        if val_node.type == "list":
                            for item in val_node.children:
                                if item.type == "string":
                                    m_raw = _text(item, source).strip()
                                    for q in ('"""', "'''", '"', "'"):
                                        if (
                                            m_raw.startswith(q)
                                            and m_raw.endswith(q)
                                            and len(m_raw) >= 2 * len(q)
                                        ):
                                            m_raw = m_raw[len(q) : -len(q)]
                                            break
                                    methods_found.append(m_raw.upper())
                        if methods_found:
                            http_method = ",".join(methods_found)

    if route_path is None:
        return None, None

    return http_method, route_path


# ── Call extraction ────────────────────────────────────────────────────────────


def _collect_calls(body_node: "Node", source: bytes) -> List[str]:
    """Recursively collect all function call names within a body node."""
    calls: List[str] = []
    if body_node is None:
        return calls

    def walk(node: "Node") -> None:
        if node.type == "call":
            func_node = node.child_by_field_name("function")
            if func_node:
                name = _text(func_node, source).split("(")[0]  # strip any inline call
                calls.append(name)
        for child in node.children:
            walk(child)

    walk(body_node)
    return calls


# ── Variable assignment extraction ────────────────────────────────────────────


def _collect_assignments(body_node: "Node", source: bytes) -> List[Dict[str, str]]:
    """Collect simple variable assignments at the direct function-body scope."""
    assignments: List[Dict[str, str]] = []
    if body_node is None:
        return assignments

    for child in body_node.children:
        if child.type == "expression_statement":
            for inner in child.children:
                if inner.type == "assignment":
                    lhs = inner.child_by_field_name("left")
                    rhs = inner.child_by_field_name("right")
                    if lhs and rhs:
                        assignments.append(
                            {
                                "name": _text(lhs, source),
                                "value": _text(rhs, source),
                            }
                        )
    return assignments


# ── Main extractor class ───────────────────────────────────────────────────────


class PythonExtractor(BaseExtractor):
    """Extract nodes and edges from Python source files using tree-sitter."""

    # Map of simple call names to known external libraries to mark as external_call
    _STDLIB_PREFIXES = frozenset(
        [
            "os",
            "sys",
            "re",
            "json",
            "math",
            "time",
            "datetime",
            "pathlib",
            "logging",
            "print",
            "len",
            "range",
            "enumerate",
            "zip",
            "map",
            "filter",
            "sorted",
            "reversed",
            "isinstance",
            "type",
            "str",
            "int",
            "float",
            "list",
            "dict",
            "set",
            "tuple",
            "open",
            "super",
        ]
    )

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

            # Collect all defined function/class names for distinguishing internal calls
            defined_names: Set[str] = set()
            self._collect_defined_names(tree.root_node, source, defined_names)

            self._walk_module(
                tree.root_node,
                source,
                rel,
                nodes,
                edges,
                defined_names,
                parent_class=None,
            )

            return nodes, edges
        except Exception as e:
            print(f"[GlideIt WARNING] Skipping {file_path}: {e}")
            return [], []

    # ──────────────────────────────────────────────────────────────
    # Internal walkers
    # ──────────────────────────────────────────────────────────────

    def _collect_defined_names(self, root: "Node", source: bytes, names: Set[str]) -> None:
        """Pre-scan: collect all function and class names defined in this file."""
        for child in root.children:
            if child.type in ("function_definition", "decorated_definition"):
                func = (
                    child
                    if child.type == "function_definition"
                    else _first_child_by_type(child, "function_definition")
                )
                if func:
                    name_node = func.child_by_field_name("name")
                    if name_node:
                        names.add(_text(name_node, source))
            elif child.type == "class_definition":
                name_node = child.child_by_field_name("name")
                if name_node:
                    names.add(_text(name_node, source))
                # Also collect methods
                body = child.child_by_field_name("body")
                if body:
                    for grandchild in body.children:
                        if grandchild.type in ("function_definition", "decorated_definition"):
                            fn = (
                                grandchild
                                if grandchild.type == "function_definition"
                                else _first_child_by_type(grandchild, "function_definition")
                            )
                            if fn:
                                mn = fn.child_by_field_name("name")
                                if mn:
                                    names.add(_text(mn, source))

    def _walk_module(
        self,
        root: "Node",
        source: bytes,
        rel: str,
        nodes: List,
        edges: List,
        defined_names: Set[str],
        parent_class: Optional[str],
    ) -> None:
        for child in root.children:
            if child.type == "import_statement":
                self._handle_import(child, source, rel, nodes, edges)
            elif child.type == "import_from_statement":
                self._handle_import_from(child, source, rel, nodes, edges)
            elif child.type == "function_definition":
                self._handle_function(child, source, rel, nodes, edges, defined_names, parent_class)
            elif child.type == "decorated_definition":
                self._handle_decorated(
                    child, source, rel, nodes, edges, defined_names, parent_class
                )
            elif child.type == "class_definition":
                self._handle_class(child, source, rel, nodes, edges, defined_names)

    def _handle_import(
        self, node: "Node", source: bytes, rel: str, nodes: List, edges: List
    ) -> None:
        """import foo, import foo as bar"""
        for name_node in _children_by_type(node, "dotted_name", "aliased_import"):
            _text(name_node, source).split(" as ")[0].strip()
            # We do NOT add import nodes to keep the graph cleaner for now — only record edges
            # (Future: could add import nodes with type="import")

    def _handle_import_from(
        self, node: "Node", source: bytes, rel: str, nodes: List, edges: List
    ) -> None:
        """from foo import bar, baz"""
        pass  # Tracked via edges in function extractors when calls are made

    def _handle_function(
        self,
        func_node: "Node",
        source: bytes,
        rel: str,
        nodes: List,
        edges: List,
        defined_names: Set[str],
        parent_class: Optional[str],
        decorators: Optional[List["Node"]] = None,
    ) -> None:
        name_node = func_node.child_by_field_name("name")
        if not name_node:
            return
        func_name = _text(name_node, source)
        line = func_node.start_point[0] + 1  # 1-indexed
        params_node = func_node.child_by_field_name("parameters")
        body_node = func_node.child_by_field_name("body")

        params = _extract_params(params_node, source)
        return_type = _extract_return_type(func_node, source)
        docstring = _extract_docstring(body_node, source)

        # Check for Flask route decorator
        http_method: Optional[str] = None
        route_path: Optional[str] = None
        is_flask_route = False

        if decorators:
            for dec in decorators:
                h, r = _is_flask_route_decorator(dec, source)
                if r is not None:
                    http_method = h
                    route_path = r
                    is_flask_route = True
                    break

        node_type = "flask_route" if is_flask_route else "python_function"
        qualified_name = f"{parent_class}.{func_name}" if parent_class else func_name

        node_id = self._make_node_id("py", rel, qualified_name)
        node = self._node(
            id=node_id,
            name=func_name,
            type=node_type,
            file=rel,
            line=line,
            params=params,
            returns={
                "type_hint": return_type,
                "variable_name": None,
                "description": None,
            },
            docstring=docstring or "No description available.",
            http_method=http_method,
            route_path=route_path,
            depth=0 if is_flask_route else 1,
        )
        nodes.append(node)

        # ── Calls ───────────────────────────────────
        calls = _collect_calls(body_node, source)
        seen_calls: Set[str] = set()
        for called_name in calls:
            if called_name in seen_calls:
                continue
            seen_calls.add(called_name)

            # Determine if internal or external
            base_name = called_name.split(".")[0]

            if called_name == qualified_name or called_name == func_name:
                # Self-recursion
                target_id = node_id
                edge_type = "circular_call"
            elif base_name in self._STDLIB_PREFIXES or (
                base_name not in defined_names and "." in called_name
            ):
                # External call
                ext_id = self._make_node_id("ext", rel, called_name)
                ext_node_exists = any(n["id"] == ext_id for n in nodes)
                if not ext_node_exists:
                    nodes.append(
                        self._node(
                            id=ext_id,
                            name=called_name,
                            type="external_call",
                            file=rel,
                            line=line,
                            depth=2,
                        )
                    )
                target_id = ext_id
                edge_type = "call"
            else:
                # Internal call — build probable target ID
                target_id = self._make_node_id("py", rel, called_name)
                edge_type = "call"

            edge_id = self._make_edge_id(node_id, target_id)
            edges.append(
                self._edge(
                    id=edge_id,
                    source=node_id,
                    target=target_id,
                    type=edge_type,
                )
            )

    def _handle_decorated(
        self,
        decorated_node: "Node",
        source: bytes,
        rel: str,
        nodes: List,
        edges: List,
        defined_names: Set[str],
        parent_class: Optional[str],
    ) -> None:
        decorators = _children_by_type(decorated_node, "decorator")
        func_node = _first_child_by_type(decorated_node, "function_definition")
        class_node = _first_child_by_type(decorated_node, "class_definition")

        if func_node:
            self._handle_function(
                func_node,
                source,
                rel,
                nodes,
                edges,
                defined_names,
                parent_class,
                decorators=decorators,
            )
        elif class_node:
            self._handle_class(class_node, source, rel, nodes, edges, defined_names)

    def _handle_class(
        self,
        class_node: "Node",
        source: bytes,
        rel: str,
        nodes: List,
        edges: List,
        defined_names: Set[str],
    ) -> None:
        name_node = class_node.child_by_field_name("name")
        if not name_node:
            return
        class_name = _text(name_node, source)
        line = class_node.start_point[0] + 1

        # Parent class
        superclasses_node = class_node.child_by_field_name("superclasses")
        parent_class_names: List[str] = []
        if superclasses_node:
            for arg in superclasses_node.children:
                if arg.type == "identifier":
                    parent_class_names.append(_text(arg, source))

        node_id = self._make_node_id("py", rel, class_name)
        node = self._node(
            id=node_id,
            name=class_name,
            type="python_class",
            file=rel,
            line=line,
            parent_classes=parent_class_names,
            depth=0,
        )
        nodes.append(node)

        # Walk class body for methods
        body_node = class_node.child_by_field_name("body")
        if body_node:
            self._walk_module(
                body_node, source, rel, nodes, edges, defined_names, parent_class=class_name
            )
