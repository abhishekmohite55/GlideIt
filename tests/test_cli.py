"""Integration tests for CLI commands — run and serve."""

import argparse
import tempfile
from pathlib import Path

import pytest

from glideit.cli import build_parser, cmd_run


class TestCmdRun:
    """Test the run command."""

    def test_run_exits_with_error_for_nonexistent_root(self):
        """cmd_run should return 1 when repo_root does not exist."""
        args = argparse.Namespace(
            repo_root="/nonexistent/path/that/does/not/exist",
            output="/tmp/glideit-out",
            exclude=[],
            single=False,
            serve=False,
        )
        result = cmd_run(args)
        assert result == 1

    def test_run_exits_with_error_for_empty_codebase(self):
        """cmd_run should return 1 when no parseable files are found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            output = root / "out"
            # Create only non-parseable files
            (root / "readme.md").write_text("# readme")
            (root / "data.json").write_text("{}")

            args = argparse.Namespace(
                repo_root=str(root),
                output=str(output),
                exclude=[],
                single=False,
                serve=False,
            )
            result = cmd_run(args)
            assert result == 1

    def test_run_succeeds_with_python_file(self):
        """cmd_run should succeed when valid Python files exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            output = root / "out"
            (root / "app.py").write_text("def main():\n    pass\n")

            args = argparse.Namespace(
                repo_root=str(root),
                output=str(output),
                exclude=[],
                single=False,
                serve=False,
            )
            result = cmd_run(args)
            assert result == 0
            assert output.exists()


class TestBuildParser:
    """Test argument parsing."""

    def test_parser_defaults(self):
        """Parser should have sensible defaults."""
        parser = build_parser()
        args = parser.parse_args(["run"])
        assert args.repo_root == "."
        assert args.output == "glideit-out"
        assert args.single is False
        assert args.serve is False
        assert args.exclude == []

    def test_parser_with_custom_output(self):
        """Parser should accept custom output directory."""
        parser = build_parser()
        args = parser.parse_args(["run", "-o", "custom-dir"])
        assert args.output == "custom-dir"

    def test_parser_with_exclude(self):
        """Parser should accept exclude patterns."""
        parser = build_parser()
        args = parser.parse_args(["run", "--exclude", "tests/", "vendor/"])
        assert "tests/" in args.exclude
        assert "vendor/" in args.exclude

    def test_parser_serve_command(self):
        """Parser should handle serve subcommand."""
        parser = build_parser()
        args = parser.parse_args(["serve", "my-output", "--port", "9000"])
        assert args.command == "serve"
        assert args.directory == "my-output"
        assert args.port == 9000

    def test_parser_version_flag(self):
        """Parser should handle --version flag."""
        parser = build_parser()
        with pytest.raises(SystemExit):
            parser.parse_args(["--version"])
