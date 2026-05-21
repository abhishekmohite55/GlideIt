"""Tests for the GraphAssembler (depth calculation and circular call detection)."""

from pathlib import Path

from glideit.graph import GraphAssembler


def test_graph_assembler_circular():
    # Construct a GraphAssembler with a dummy path
    assembler = GraphAssembler(Path("."))

    # Scenario: mutual recursion
    # ping calls pong
    # pong calls ping
    # entry point is ping (type = flask_route)
    nodes = [
        {
            "id": "py:test.py:ping",
            "name": "ping",
            "type": "flask_route",
            "file": "test.py",
            "line": 1,
            "depth": 0,
        },
        {
            "id": "py:test.py:pong",
            "name": "pong",
            "type": "python_function",
            "file": "test.py",
            "line": 4,
            "depth": 1,
        },
    ]

    edges = [
        {
            "id": "py:test.py:ping--py:test.py:pong",
            "source": "py:test.py:ping",
            "target": "py:test.py:pong",
            "type": "call",
        },
        {
            "id": "py:test.py:pong--py:test.py:ping",
            "source": "py:test.py:pong",
            "target": "py:test.py:ping",
            "type": "call",
        },
    ]

    assembler.add(nodes, edges)

    # Trigger serialization steps manually to verify they don't hang
    assembler._compute_depths()
    assembler._mark_circular_edges()

    # Assert ping depth is 0, pong depth is 1
    assert assembler._nodes["py:test.py:ping"]["depth"] == 0
    assert assembler._nodes["py:test.py:pong"]["depth"] == 1

    # Assert edge pong->ping is marked as circular_call
    circular_edge = next(e for e in assembler._edges if e["source"] == "py:test.py:pong")
    assert circular_edge["type"] == "circular_call"

    # Assert edge ping->pong remains call
    direct_edge = next(e for e in assembler._edges if e["source"] == "py:test.py:ping")
    assert direct_edge["type"] == "call"


def test_graph_assembler_resolution():
    assembler = GraphAssembler(Path("."))

    # Scenario: App.jsx uses Header. Header is defined in components/Header.jsx
    # Extractor for App.jsx creates:
    #   - Node App (real component)
    #   - Node Header (stub, line=0)
    #   - Edge App -> Header (stub ID)
    # Extractor for components/Header.jsx creates:
    #   - Node Header (real component, line=5)
    nodes_app = [
        {
            "id": "jsx:App.jsx:App",
            "name": "App",
            "type": "react_component",
            "file": "App.jsx",
            "line": 3,
        },
        {
            "id": "jsx:App.jsx:Header",
            "name": "Header",
            "type": "react_component",
            "file": "App.jsx",
            "line": 0,  # stub node!
        },
    ]

    edges_app = [
        {
            "id": "jsx:App.jsx:App--jsx:App.jsx:Header",
            "source": "jsx:App.jsx:App",
            "target": "jsx:App.jsx:Header",
            "type": "render",
        }
    ]

    nodes_header = [
        {
            "id": "jsx:components/Header.jsx:Header",
            "name": "Header",
            "type": "react_component",
            "file": "components/Header.jsx",
            "line": 5,  # real definition!
        }
    ]

    assembler.add(nodes_app, edges_app)
    assembler.add(nodes_header, [])

    # Clean up and resolve
    assembler._resolve_and_cleanup_graph()

    # The stub node should be removed, leaving only the real definition and App
    assert "jsx:App.jsx:Header" not in assembler._nodes
    assert "jsx:components/Header.jsx:Header" in assembler._nodes
    assert "jsx:App.jsx:App" in assembler._nodes

    # The edge target should be mapped to the real Header node
    resolved_edge = assembler._edges[0]
    assert resolved_edge["target"] == "jsx:components/Header.jsx:Header"
    assert resolved_edge["id"] == "jsx:App.jsx:App--jsx:components/Header.jsx:Header"
