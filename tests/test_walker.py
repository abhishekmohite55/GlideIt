"""Tests for the Walker module — file discovery and exclusion filtering."""

import tempfile
from pathlib import Path

import pytest

from glideit.walker import Walker


def _create_test_files(root: Path, files: list[str]) -> None:
    """Create a set of files under root for walker tests."""
    for rel_path in files:
        fp = root / rel_path
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text("# test file")


class TestWalkerFileDiscovery:
    """Test basic file discovery."""

    def test_discovers_python_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, ["a.py", "b.py", "sub/c.py"])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            py_names = {f.name for f in py_files}
            assert py_names == {"a.py", "b.py", "c.py"}

    def test_discovers_jsx_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, ["App.jsx", "index.js", "comp.tsx", "util.ts"])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            jsx_names = {f.name for f in jsx_files}
            assert jsx_names == {"App.jsx", "index.js", "comp.tsx", "util.ts"}

    def test_ignores_non_matching_extensions(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, ["readme.md", "data.json", "a.py", "App.jsx"])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert len(py_files) == 1
            assert len(jsx_files) == 1

    def test_empty_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert py_files == []
            assert jsx_files == []


class TestWalkerExclusion:
    """Test exclusion filtering."""

    def test_builtin_ignores_node_modules(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, [
                "app.py",
                "node_modules/pkg/index.js",
                "node_modules/pkg/lib.js",
            ])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert len(py_files) == 1
            assert jsx_files == []  # node_modules should be ignored

    def test_builtin_ignores_pycache(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, [
                "app.py",
                "__pycache__/app.cpython-311.pyc",
            ])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert len(py_files) == 1

    def test_builtin_ignores_git_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, [
                "app.py",
                ".git/HEAD",
                ".git/objects/abc",
            ])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert len(py_files) == 1

    def test_custom_exclude_patterns(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            _create_test_files(root, [
                "app.py",
                "tests/test_app.py",
                "migrations/001_initial.py",
            ])
            walker = Walker(root, exclude_patterns=["tests/", "migrations/"])
            py_files, jsx_files = walker.collect()
            py_names = {f.name for f in py_files}
            assert py_names == {"app.py"}

    def test_gitignore_is_honored(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / ".gitignore").write_text("vendor/\n*.generated.py\n")
            _create_test_files(root, [
                "app.py",
                "vendor/lib.py",
                "schema.generated.py",
            ])
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            py_names = {f.name for f in py_files}
            assert py_names == {"app.py"}

    def test_symlinks_are_skipped(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            real_file = root / "real.py"
            real_file.write_text("# real")
            link = root / "link.py"
            # On Windows, symlinks may require admin; skip if not available
            try:
                link.symlink_to(real_file)
            except (OSError, PermissionError):
                pytest.skip("Symlinks not supported on this platform")
            walker = Walker(root)
            py_files, jsx_files = walker.collect()
            assert len(py_files) == 1  # Only real.py, not link.py
