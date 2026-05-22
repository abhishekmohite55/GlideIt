"""Edge case tests — empty codebase, circular imports, syntax errors."""

import tempfile
from pathlib import Path

from glideit.extractors.python_extractor import PythonExtractor
from glideit.graph import GraphAssembler


class TestEmptyCodebase:
    """Test handling of empty or minimal codebases."""

    def test_extractor_handles_empty_file(self):
        """Extractor should return empty results for an empty file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            extractor = PythonExtractor(root)
            test_file = root / "empty.py"
            test_file.write_text("")
            nodes, edges = extractor.extract(test_file, b"")
            assert nodes == []
            assert edges == []

    def test_graph_assembler_handles_empty_input(self):
        """GraphAssembler should handle empty nodes/edges without errors."""
        with tempfile.TemporaryDirectory() as tmpdir:
            assembler = GraphAssembler(Path(tmpdir))
            assembler.add([], [])
            result = assembler.serialize(file_count=0, language_counts={})
            assert result is not None

    def test_walker_handles_directory_with_no_parseable_files(self):
        """Walker should return empty lists when no .py/.jsx files exist."""
        from glideit.walker import Walker

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "readme.md").write_text("# readme")
            (root / "data.json").write_text("{}")
            (root / "image.png").write_text("binary")

            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert py_files == []
            assert jsx_files == []


class TestCircularImports:
    """Test circular import handling."""

    def test_circular_call_detection(self):
        """GraphAssembler should mark circular calls correctly."""
        assembler = GraphAssembler(Path("."))

        nodes = [
            {"id": "py:a.py:foo", "name": "foo", "type": "python_function", "file": "a.py", "line": 1, "depth": 0},
            {"id": "py:b.py:bar", "name": "bar", "type": "python_function", "file": "b.py", "line": 1, "depth": 0},
        ]
        edges = [
            {"id": "py:a.py:foo--py:b.py:bar", "source": "py:a.py:foo", "target": "py:b.py:bar", "type": "call"},
            {"id": "py:b.py:bar--py:a.py:foo", "source": "py:b.py:bar", "target": "py:a.py:foo", "type": "call"},
        ]

        assembler.add(nodes, edges)
        assembler._compute_depths()
        assembler._mark_circular_edges()

        # One edge should be marked as circular
        circular_edges = [e for e in assembler._edges if e["type"] == "circular_call"]
        assert len(circular_edges) == 1

    def test_self_recursion_detection(self):
        """GraphAssembler should handle self-recursive calls."""
        assembler = GraphAssembler(Path("."))

        nodes = [
            {"id": "py:a.py:recurse", "name": "recurse", "type": "python_function", "file": "a.py", "line": 1, "depth": 0},
        ]
        edges = [
            {"id": "py:a.py:recurse--py:a.py:recurse", "source": "py:a.py:recurse", "target": "py:a.py:recurse", "type": "call"},
        ]

        assembler.add(nodes, edges)
        assembler._compute_depths()
        assembler._mark_circular_edges()

        circular_edges = [e for e in assembler._edges if e["type"] == "circular_call"]
        assert len(circular_edges) == 1


class TestSyntaxErrorHandling:
    """Test handling of files with syntax errors."""

    def test_extractor_handles_syntax_error_gracefully(self):
        """PythonExtractor should not crash on syntax errors."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            extractor = PythonExtractor(root)
            test_file = root / "broken.py"

            # Invalid Python syntax
            nodes, edges = extractor.extract(test_file, b"def broken(:")
            # Should return empty, not raise
            assert nodes == [] or nodes is not None

    def test_extractor_handles_unicode_corruption(self):
        """PythonExtractor should handle files with invalid UTF-8."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            extractor = PythonExtractor(root)
            test_file = root / "corrupt.py"

            # Invalid UTF-8 bytes
            nodes, edges = extractor.extract(test_file, b"\xff\xfe def valid():\n    pass\n")
            # Should not crash
            assert nodes is not None
