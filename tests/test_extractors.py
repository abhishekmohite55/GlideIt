"""Basic smoke tests for GlideIt extractors."""

import tempfile
from pathlib import Path

import pytest

from glideit.extractors.jsx_extractor import JSXExtractor
from glideit.extractors.python_extractor import PythonExtractor

SIMPLE_PYTHON = b"""
def greet(name: str) -> str:
    return f"Hello, {name}"

def main():
    greet("world")
"""

EMPTY_PYTHON = b""

SYNTAX_ERROR_PYTHON = b"def broken(:"


def test_python_extractor_basic():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        extractor = PythonExtractor(root)
        test_file = root / "test.py"
        results, _ = extractor.extract(test_file, SIMPLE_PYTHON)
        function_names = [r["name"] for r in results]
        assert "greet" in function_names
        assert "main" in function_names


def test_python_extractor_empty_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        extractor = PythonExtractor(root)
        test_file = root / "empty.py"
        results, _ = extractor.extract(test_file, EMPTY_PYTHON)
        assert results == []  # should return empty list, not crash


def test_python_extractor_syntax_error():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        extractor = PythonExtractor(root)
        test_file = root / "bad.py"
        # Should not raise an exception — should return empty or partial result
        try:
            results, _ = extractor.extract(test_file, SYNTAX_ERROR_PYTHON)
        except Exception as e:
            pytest.fail(f"Extractor should not raise on syntax error, but got: {e}")


SIMPLE_JSX = b"""
import React from 'react';

function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

export default Button;
"""


def test_jsx_extractor_basic():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        extractor = JSXExtractor(root)
        test_file = root / "Button.jsx"
        results, _ = extractor.extract(test_file, SIMPLE_JSX)
        component_names = [r["name"] for r in results]
        assert "Button" in component_names


FLASK_ROUTES_PYTHON = b"""
from flask import Blueprint, Flask

app = Flask(__name__)
bp = Blueprint('users', __name__)
api = Blueprint('api', __name__)

@app.route('/login', methods=['GET', 'POST'])
def login():
    pass

@bp.route('/users')
def list_users():
    pass

@api.get('/items')
def get_items():
    pass

@api.post('/items')
def create_item():
    pass

@app.route(rule='/rule-kw')
def rule_keyword():
    pass

@bp.route('/dummy')
@jwt_required()
@login_required
def dummy():
    pass
"""


def test_python_extractor_flask_routes():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        extractor = PythonExtractor(root)
        test_file = root / "routes.py"
        results, _ = extractor.extract(test_file, FLASK_ROUTES_PYTHON)

        # Let's map function name to its details
        routes_by_name = {r["name"]: r for r in results if r["type"] == "flask_route"}

        # Verify login route
        assert "login" in routes_by_name
        assert routes_by_name["login"]["route_path"] == "/login"
        assert routes_by_name["login"]["http_method"] == "GET,POST"

        # Verify list_users route (should default to GET)
        assert "list_users" in routes_by_name
        assert routes_by_name["list_users"]["route_path"] == "/users"
        assert routes_by_name["list_users"]["http_method"] == "GET"

        # Verify get_items route (shortcut .get -> GET)
        assert "get_items" in routes_by_name
        assert routes_by_name["get_items"]["route_path"] == "/items"
        assert routes_by_name["get_items"]["http_method"] == "GET"

        # Verify create_item route (shortcut .post -> POST)
        assert "create_item" in routes_by_name
        assert routes_by_name["create_item"]["route_path"] == "/items"
        assert routes_by_name["create_item"]["http_method"] == "POST"

        # Verify rule_keyword route (rule='/rule-kw' keyword argument)
        assert "rule_keyword" in routes_by_name
        assert routes_by_name["rule_keyword"]["route_path"] == "/rule-kw"

        # Verify dummy route (has other decorators that are not routes)
        assert "dummy" in routes_by_name
        assert routes_by_name["dummy"]["route_path"] == "/dummy"
        assert routes_by_name["dummy"]["http_method"] == "GET"
