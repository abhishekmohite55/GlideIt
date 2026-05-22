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
from typing import Any, Optional

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


def _children_by_type(node: "Node", *types: str) -> list["Node"]:
    return [c for c in node.children if c.type in types]


def _first_child_by_type(node: "Node", *types: str) -> Optional["Node"]:
    for c in node.children:
        if c.type in types:
            return c
    return None


def _strip_quotes(raw: str) -> str:
    """Strip outer quotes from a string literal."""
    for q in ('"""', "'''", '"', "'"):
        if raw.startswith(q) and raw.endswith(q) and len(raw) >= 2 * len(q):
            return raw[len(q) : -len(q)].strip()
    return raw


def _extract_docstring(body_node: "Node", source: bytes) -> Optional[str]:
    """Extract the first string literal in a function/class body as docstring."""
    if body_node is None:
        return None
    for child in body_node.children:
        if child.type == "expression_statement":
            for inner in child.children:
                if inner.type in ("string", "concatenated_string"):
                    raw = _text(inner, source).strip()
                    stripped = _strip_quotes(raw)
                    if stripped != raw:
                        return stripped
                    return raw
        break  # docstring must be first statement
    return None


# ── Param parsing helpers ─────────────────────────────────────────────────────


def _parse_identifier_param(child: "Node", source: bytes) -> dict[str, Any]:
    return {"name": _text(child, source), "type_hint": None, "default_value": None}


def _parse_typed_param(child: "Node", source: bytes) -> dict[str, Any]:
    name_node = _first_child_by_type(child, "identifier")
    type_node = child.child_by_field_name("type")
    return {
        "name": _text(name_node, source) if name_node else "?",
        "type_hint": _text(type_node, source) if type_node else None,
        "default_value": None,
    }


def _parse_default_param(child: "Node", source: bytes) -> dict[str, Any]:
    name_node = child.child_by_field_name("name")
    value_node = child.child_by_field_name("value")
    return {
        "name": _text(name_node, source) if name_node else "?",
        "type_hint": None,
        "default_value": _text(value_node, source) if value_node else None,
    }


def _parse_typed_default_param(child: "Node", source: bytes) -> dict[str, Any]:
    name_node = child.child_by_field_name("name")
    type_node = child.child_by_field_name("type")
    value_node = child.child_by_field_name("value")
    return {
        "name": _text(name_node, source) if name_node else "?",
        "type_hint": _text(type_node, source) if type_node else None,
        "default_value": _text(value_node, source) if value_node else None,
    }


def _parse_splat_param(child: "Node", source: bytes) -> Optional[dict[str, Any]]:
    inner = _first_child_by_type(child, "identifier")
    prefix = "*" if child.type == "list_splat_pattern" else "**"
    if inner:
        return {
            "name": prefix + _text(inner, source),
            "type_hint": None,
            "default_value": None,
        }
    return None


def _extract_params(parameters_node: "Node", source: bytes) -> list[dict[str, Any]]:
    """Parse a parameters node into list of {name, type_hint, default_value}."""
    if parameters_node is None:
        return []

    params = []
    for child in parameters_node.children:
        if child.type == "identifier":
            params.append(_parse_identifier_param(child, source))
        elif child.type == "typed_parameter":
            params.append(_parse_typed_param(child, source))
        elif child.type == "default_parameter":
            params.append(_parse_default_param(child, source))
        elif child.type == "typed_default_parameter":
            params.append(_parse_typed_default_param(child, source))
        elif child.type in ("list_splat_pattern", "dictionary_splat_pattern", "variadic", "keyword_variadic"):
            p = _parse_splat_param(child, source)
            if p:
                params.append(p)

    return [p for p in params if p["name"] not in ("self", "cls")]


def _extract_return_type(func_node: "Node", source: bytes) -> Optional[str]:
    """Get return type annotation from function definition."""
    return_type = func_node.child_by_field_name("return_type")
    if return_type:
        # Strip leading '->'
        t = _text(return_type, source).strip().lstrip("-").lstrip(">").strip()
        return t or None
    return None


# ── Flask route detection ──────────────────────────────────────────────────────


def _extract_flask_route_path(args_node: "Node", source: bytes) -> Optional[str]:
    """Extract route path from the first string arg or rule= keyword argument."""
    for arg in args_node.children:
        if arg.type == "string":
            raw = _text(arg, source).strip()
            stripped = _strip_quotes(raw)
            return stripped if stripped != raw else raw
        if arg.type == "keyword_argument":
            kw_name = arg.child_by_field_name("name")
            if kw_name and _text(kw_name, source) == "rule":
                kw_val = arg.child_by_field_name("value")
                if kw_val and kw_val.type == "string":
                    raw = _text(kw_val, source).strip()
                    stripped = _strip_quotes(raw)
                    return stripped if stripped != raw else raw
    return None


def _extract_flask_methods(args_node: "Node", source: bytes) -> Optional[str]:
    """Extract HTTP methods from methods=['GET','POST'] keyword argument."""
    for arg in args_node.children:
        if arg.type != "keyword_argument":
            continue
        name_node = arg.child_by_field_name("name")
        if not name_node or _text(name_node, source) != "methods":
            continue
        val_node = arg.child_by_field_name("value")
        if not val_node or val_node.type != "list":
            continue
        methods_found = []
        for item in val_node.children:
            if item.type == "string":
                m_raw = _strip_quotes(_text(item, source).strip())
                if m_raw != _text(item, source).strip():
                    methods_found.append(m_raw.upper())
                else:
                    methods_found.append(_text(item, source).strip().upper())
        if methods_found:
            return ",".join(methods_found)
    return None


def _is_flask_route_decorator(
    decorator_node: "Node", source: bytes
) -> tuple[Optional[str], Optional[str]]:
    """
    Detect Flask route decorators on app or blueprints (name-agnostic).
    Matches @<any>.route, @<any>.get, @<any>.post, @<any>.put, @<any>.delete, @<any>.patch.
    Returns (http_method, route_path) or (None, None).
    """
    call_node = _first_child_by_type(decorator_node, "call")
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

    default_method = "GET" if method_name == "route" else method_name.upper()
    http_method: str = default_method
    route_path: Optional[str] = None

    args_node = _first_child_by_type(call_node, "argument_list")
    if args_node:
        path = _extract_flask_route_path(args_node, source)
        if path is not None:
            route_path = path
        methods_str = _extract_flask_methods(args_node, source)
        if methods_str is not None:
            http_method = methods_str

    if route_path is None:
        return None, None

    return http_method, route_path


# ── Call extraction ────────────────────────────────────────────────────────────


def _collect_calls(body_node: "Node", source: bytes) -> list[str]:
    """Recursively collect all function call names within a body node."""
    calls: list[str] = []
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


def _collect_assignments(body_node: "Node", source: bytes) -> list[dict[str, str]]:
    """Collect simple variable assignments at the direct function-body scope."""
    assignments: list[dict[str, str]] = []
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

    def _parse_source(self, source: bytes) -> Any:
        try:
            return _PARSER.parse(source)
        except NameError as exc:
            raise RuntimeError(f"tree-sitter is not available: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"tree-sitter parse error: {exc}") from exc

    def extract(
        self,
        file_path: Path,
        source: bytes,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        if not _TS_AVAILABLE:
            return [], []

        try:
            tree = self._parse_source(source)
            return self._extract_from_tree(file_path, source, tree)
        except Exception as e:
            print(f"[GlideIt WARNING] Skipping {file_path}: {e}")
            return [], []

    def _extract_from_tree(
        self,
        file_path: Path,
        source: bytes,
        tree: Any,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        rel = self._rel(file_path)
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []
        seen_node_ids: set[str] = set()
        defined_names: set[str] = set()
        import_map: dict[str, str] = {}

        self._collect_defined_names(tree.root_node, source, defined_names)
        self._collect_imports(tree.root_node, source, import_map)
        self._walk_module(
            tree.root_node,
            source,
            rel,
            nodes,
            edges,
            defined_names,
            parent_class=None,
            import_map=import_map,
            seen_node_ids=seen_node_ids,
        )
        return nodes, edges

    # ──────────────────────────────────────────────────────────────
    # Internal walkers
    # ──────────────────────────────────────────────────────────────

    def _collect_defined_names(self, root: "Node", source: bytes, names: set[str]) -> None:
        """Pre-scan: collect all function and class names defined in this file."""
        for child in root.children:
            self._collect_name_from_child(child, source, names)

    def _collect_name_from_child(self, child: "Node", source: bytes, names: set[str]) -> None:
        if child.type in ("function_definition", "decorated_definition"):
            self._collect_function_name(child, source, names)
        elif child.type == "class_definition":
            self._collect_class_and_methods(child, source, names)

    def _collect_function_name(self, child: "Node", source: bytes, names: set[str]) -> None:
        func = (
            child
            if child.type == "function_definition"
            else _first_child_by_type(child, "function_definition")
        )
        if func:
            name_node = func.child_by_field_name("name")
            if name_node:
                names.add(_text(name_node, source))

    def _collect_class_and_methods(self, class_node: "Node", source: bytes, names: set[str]) -> None:
        name_node = class_node.child_by_field_name("name")
        if name_node:
            names.add(_text(name_node, source))
        body = class_node.child_by_field_name("body")
        if body:
            for grandchild in body.children:
                if grandchild.type in ("function_definition", "decorated_definition"):
                    self._collect_function_name(grandchild, source, names)

    def _collect_imports(self, root: "Node", source: bytes, import_map: dict[str, str]) -> None:
        """Collect import statements to map names/aliases to their module sources."""
        for child in root.children:
            if child.type == "import_statement":
                self._handle_import_statement(child, source, import_map)
            elif child.type == "import_from_statement":
                self._handle_from_import(child, source, import_map)

    def _handle_import_statement(self, child: "Node", source: bytes, import_map: dict[str, str]) -> None:
        name_node = child.child_by_field_name("name")
        if not name_node:
            return
        module_name = _text(name_node, source)
        alias_node = child.child_by_field_name("alias")
        if alias_node:
            import_map[_text(alias_node, source)] = module_name
        else:
            import_map[module_name] = module_name

    def _handle_from_import(self, child: "Node", source: bytes, import_map: dict[str, str]) -> None:
        module_node = child.child_by_field_name("module_name")
        if not module_node:
            return
        module_name = _text(module_node, source)
        module_dotted_name = child.child_by_field_name("module_name")
        name_nodes = [c for c in _children_by_type(child, "dotted_name") if c != module_dotted_name]
        for dn in name_nodes:
            first_id = _first_child_by_type(dn, "identifier")
            if not first_id:
                continue
            imported_name = _text(first_id, source)
            alias_node = dn.children[-1] if len(dn.children) > 1 else None
            if alias_node and alias_node.type == "identifier" and _text(alias_node, source) != imported_name:
                import_map[_text(alias_node, source)] = f"{module_name}.{imported_name}"
            else:
                import_map[imported_name] = f"{module_name}.{imported_name}"

    def _walk_module(
        self,
        root: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        defined_names: set[str],
        parent_class: Optional[str],
        import_map: Optional[dict[str, str]] = None,
        seen_node_ids: Optional[set[str]] = None,
    ) -> None:
        if import_map is None:
            import_map = {}
        if seen_node_ids is None:
            seen_node_ids = set()
        for child in root.children:
            if child.type == "function_definition":
                self._handle_function(child, source, rel, nodes, edges, defined_names, parent_class, import_map=import_map, seen_node_ids=seen_node_ids)
            elif child.type == "decorated_definition":
                self._handle_decorated(
                    child, source, rel, nodes, edges, defined_names, parent_class, import_map=import_map, seen_node_ids=seen_node_ids
                )
            elif child.type == "class_definition":
                self._handle_class(child, source, rel, nodes, edges, defined_names, import_map=import_map, seen_node_ids=seen_node_ids)

    def _handle_function(
        self,
        func_node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        defined_names: set[str],
        parent_class: Optional[str],
        decorators: Optional[list["Node"]] = None,
        import_map: Optional[dict[str, str]] = None,
        seen_node_ids: Optional[set[str]] = None,
    ) -> None:
        if import_map is None:
            import_map = {}
        if seen_node_ids is None:
            seen_node_ids = set()
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
        if node_id not in seen_node_ids:
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
                depth=0,
            )
            nodes.append(node)
            seen_node_ids.add(node_id)

        # ── Calls ───────────────────────────────────
        self._create_call_edges(
            node_id=node_id,
            func_name=func_name,
            qualified_name=qualified_name,
            body_node=body_node,
            source=source,
            rel=rel,
            nodes=nodes,
            edges=edges,
            defined_names=defined_names,
            import_map=import_map,
            seen_node_ids=seen_node_ids,
        )

    def _create_call_edges(
        self,
        node_id: str,
        func_name: str,
        qualified_name: str,
        body_node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        defined_names: set[str],
        import_map: Optional[dict[str, str]] = None,
        seen_node_ids: Optional[set[str]] = None,
    ) -> None:
        if import_map is None:
            import_map = {}
        if seen_node_ids is None:
            seen_node_ids = set()
        calls = _collect_calls(body_node, source)
        seen_calls: set[str] = set()
        for called_name in calls:
            if called_name in seen_calls:
                continue
            seen_calls.add(called_name)
            base_name = called_name.split(".")[0]
            if called_name == qualified_name or called_name == func_name:
                target_id = node_id
                edge_type = "circular_call"
            elif base_name in self._STDLIB_PREFIXES or (
                base_name not in defined_names and (
                    "." in called_name or
                    (base_name in import_map and "." in import_map[base_name] and not import_map[base_name].startswith("."))
                )
            ):
                ext_id = self._make_node_id("ext", rel, called_name)
                if ext_id not in seen_node_ids:
                    nodes.append(
                        self._node(
                            id=ext_id,
                            name=called_name,
                            type="external_call",
                            file=rel,
                            line=0,
                            depth=2,
                        )
                    )
                    seen_node_ids.add(ext_id)
                target_id = ext_id
                edge_type = "call"
            else:
                if base_name in import_map:
                    import_source = import_map[base_name]
                    target_file = import_source.replace(".", "/")
                    if "." in called_name:
                        func_part = called_name.split(".", 1)[1]
                        target_id = self._make_node_id("py", target_file, func_part)
                    else:
                        target_id = self._make_node_id("py", target_file, base_name)
                else:
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
        nodes: list,
        edges: list,
        defined_names: set[str],
        parent_class: Optional[str],
        import_map: Optional[dict[str, str]] = None,
        seen_node_ids: Optional[set[str]] = None,
    ) -> None:
        if seen_node_ids is None:
            seen_node_ids = set()
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
                import_map=import_map,
                seen_node_ids=seen_node_ids,
            )
        elif class_node:
            self._handle_class(class_node, source, rel, nodes, edges, defined_names, import_map=import_map, seen_node_ids=seen_node_ids)

    def _handle_class(
        self,
        class_node: "Node",
        source: bytes,
        rel: str,
        nodes: list,
        edges: list,
        defined_names: set[str],
        import_map: Optional[dict[str, str]] = None,
        seen_node_ids: Optional[set[str]] = None,
    ) -> None:
        if import_map is None:
            import_map = {}
        if seen_node_ids is None:
            seen_node_ids = set()
        name_node = class_node.child_by_field_name("name")
        if not name_node:
            return
        class_name = _text(name_node, source)
        line = class_node.start_point[0] + 1

        # Parent class
        superclasses_node = class_node.child_by_field_name("superclasses")
        parent_class_names: list[str] = []
        if superclasses_node:
            for arg in superclasses_node.children:
                if arg.type == "identifier":
                    parent_class_names.append(_text(arg, source))

        node_id = self._make_node_id("py", rel, class_name)
        if node_id not in seen_node_ids:
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
            seen_node_ids.add(node_id)

        # Walk class body for methods
        body_node = class_node.child_by_field_name("body")
        if body_node:
            self._walk_module(
                body_node, source, rel, nodes, edges, defined_names, parent_class=class_name, import_map=import_map, seen_node_ids=seen_node_ids
            )
