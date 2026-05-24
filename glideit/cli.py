"""
GlideIt CLI entry point.

Usage:
    glideit run [--output ./custom-dir]
    glideit --version
    glideit --help
"""

from __future__ import annotations

import argparse
import logging
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from glideit import __version__

logger = logging.getLogger(__name__)

MAX_PORT_ATTEMPTS = 100

# Colour helpers (no deps)


def _cyan(s: str) -> str:
    return f"\033[96m{s}\033[0m"


def _green(s: str) -> str:
    return f"\033[92m{s}\033[0m"


def _yellow(s: str) -> str:
    return f"\033[93m{s}\033[0m"


def _red(s: str) -> str:
    return f"\033[91m{s}\033[0m"


def _bold(s: str) -> str:
    return f"\033[1m{s}\033[0m"


# ──────────────────────────────────────────────
# Subcommand: run
# ──────────────────────────────────────────────


def cmd_run(args: argparse.Namespace) -> int:
    """Execute the full parse → render pipeline."""
    from glideit.extractors.jsx_extractor import JSXExtractor
    from glideit.extractors.python_extractor import PythonExtractor
    from glideit.graph import GraphAssembler
    from glideit.renderer_builder import build_renderer
    from glideit.walker import Walker

    repo_root = Path(args.repo_root).resolve()
    output_dir = Path(args.output).resolve()

    if not repo_root.exists():
        logger.error(_red(f"Repo root does not exist: {repo_root}"))
        return 1

    print(_bold(_cyan("GlideIt") + " — scanning project..."))

    walker = Walker(repo_root, exclude_patterns=args.exclude)
    py_files, jsx_files = walker.collect()

    print(f"  Parsing Python files...  ({_bold(str(len(py_files)))} found)")
    print(f"  Parsing JSX files...     ({_bold(str(len(jsx_files)))} found)")

    if not py_files and not jsx_files:
        print(_yellow("[notice] No parseable files found after filtering."))
        return 1

    assembler = GraphAssembler(repo_root)
    py_extractor = PythonExtractor(repo_root)
    jsx_extractor = JSXExtractor(repo_root)

    _process_extracted_files(py_files, py_extractor, assembler, repo_root, "Python")
    _process_extracted_files(jsx_files, jsx_extractor, assembler, repo_root, "JSX/JS/TSX")

    print(f"  {_bold('Total files parsed')}: {len(py_files) + len(jsx_files)}")

    # ── Build output ──────────────────────────
    print("  Building output...")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Build the graph JSON string (no disk write yet)
    graph_json_str = assembler.serialize(
        file_count=len(py_files) + len(jsx_files),
        language_counts={"python": len(py_files), "jsx": len(jsx_files)},
    )

    # Build/copy renderer assets FIRST (this cleans output_dir and copies fresh assets)
    try:
        build_renderer(output_dir, graph_data=graph_json_str, single_file=args.single)
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        logger.error(_red(f"Renderer build failed: {exc}"))
        return 1

    # graph-data.json is now written by build_renderer as the final step

    if args.single:
        print(
            _green("\nDone.")
            + f" Self-contained HTML built. Open {_bold(str(output_dir / 'index.html'))} directly in your browser."
        )
    else:
        print(_green("\nDone.") + f" Visualizer assets generated in {_bold(str(output_dir))}.")

    # ── Auto-serve if requested ────────────────
    if args.serve:
        print("")
        return start_server(output_dir)

    return 0


def _process_extracted_files(
    files: list[Path],
    extractor: Any,
    assembler: Any,
    repo_root: Path,
    label: str,
) -> None:
    """Process a collection of files through an extractor and collect into assembler."""
    print(f"  {_bold('Processing')} {label} files...")
    for i, fp in enumerate(files, 1):
        try:
            source = fp.read_bytes()
            nodes, edges = extractor.extract(fp, source)
            assembler.add(nodes, edges)
            if i % 10 == 0 or i == len(files):
                print(f"    Progress: {i}/{len(files)} files processed")
        except (SyntaxError, ValueError, OSError) as exc:
            print(_yellow(f"  [warn] Skipping {fp.relative_to(repo_root)}: {exc}"))


# ──────────────────────────────────────────────
# Subcommand: archive
# ──────────────────────────────────────────────


def cmd_archive(args: argparse.Namespace) -> int:
    """Create a snapshot archive of the current graph data."""
    from glideit.archive import create_archive

    output_dir = Path(args.output).resolve()
    graph_path = output_dir / "graph-data.json"

    if not graph_path.exists():
        logger.error(
            _red(
                f"Graph data not found at {graph_path}. "
                "Run 'glideit run' first."
            )
        )
        return 1

    entry = create_archive(output_dir, name=args.name)
    print(
        _green("Archive created:")
        + f" {_bold(entry['name'])} ({entry['filename']})"
    )
    return 0


# ──────────────────────────────────────────────
# Subcommand: serve & Local Web Server Logic
# ──────────────────────────────────────────────


def _build_archive_handler(directory: Path):
    """Build an HTTP request handler that also handles the archive DELETE API."""
    import http.server
    import json as json_module

    class ArchiveHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def log_message(self, msg_format, *args):
            pass

        def _send_json(self, status: int, data: dict) -> None:
            body = json_module.dumps(data).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_DELETE(self) -> None:
            import re

            from glideit.archive import delete_archive

            match = re.match(r"^/api/archives/([a-f0-9]+)$", self.path)
            if not match:
                self._send_json(404, {"error": "Not found"})
                return

            archive_id = match.group(1)
            success = delete_archive(directory, archive_id)
            if success:
                self._send_json(200, {"success": True})
            else:
                self._send_json(404, {"error": "Archive not found"})

    return ArchiveHandler


def start_server(directory: Path, port: int = 8000) -> int:
    """Serve the output directory with a local HTTP server and open the browser."""
    import http.server
    import webbrowser
    from threading import Thread

    handler = _build_archive_handler(directory)
    attempts = 0
    actual_port = port
    server = None

    while attempts < MAX_PORT_ATTEMPTS:
        try:
            server = http.server.ThreadingHTTPServer(("", actual_port), handler)
            break
        except OSError:
            actual_port += 1
            attempts += 1

    if server is None:
        logger.error(_red("Could not find a free port to bind the server."))
        return 1

    print(_green(f"  Starting local server at http://localhost:{actual_port}"))  # NOSONAR
    print(_cyan("  Press Ctrl+C to stop the server."))

    def open_browser():
        time.sleep(0.5)
        webbrowser.open(f"http://localhost:{actual_port}")  # NOSONAR

    Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print(_bold(_cyan("\nServer stopped.")))
        server.shutdown()
    finally:
        server.server_close()
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    """Serve the generated visualization directory."""
    directory = Path(args.directory).resolve()
    if not directory.exists():
        logger.error(_red(f"Directory to serve does not exist: {directory}"))
        return 1
    index_html = directory / "index.html"
    if not index_html.exists():
        print(
            _yellow(
                f"[warn] index.html not found in {directory}. Make sure you ran 'glideit run' first."
            )
        )

    return start_server(directory, args.port)


# ──────────────────────────────────────────────
# Argument parser
# ──────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="glideit",
        description="GlideIt — Codebase Visualization Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  glideit run                         # parse current directory\n"
            "  glideit run --single                # parse and bundle into a single self-contained HTML file\n"
            "  glideit run --serve                 # parse and automatically open in the browser\n"
            "  glideit serve                       # serve existing visualizer output directory\n"
        ),
    )
    parser.add_argument("--version", "-V", action="version", version=f"GlideIt {__version__}")

    subparsers = parser.add_subparsers(dest="command")

    # run parser
    run_parser = subparsers.add_parser("run", help="Parse a codebase and produce the visual output")
    run_parser.add_argument(
        "repo_root",
        nargs="?",
        default=".",
        help="Path to the repository root to parse (default: current directory)",
    )
    run_parser.add_argument(
        "--output",
        "-o",
        default="glideit-out",
        metavar="DIR",
        help="Output directory (default: glideit-out/)",
    )
    run_parser.add_argument(
        "--single",
        action="store_true",
        help="Bundle the visualizer as a single, self-contained HTML file containing the JSON data",
    )
    run_parser.add_argument(
        "--serve",
        "-s",
        action="store_true",
        help="Parse the codebase, build the visualizer, and then automatically spin up a local server to view it",
    )
    run_parser.add_argument(
        "--exclude",
        nargs="*",
        default=[],
        metavar="PATTERN",
        help='Glob patterns to exclude from scanning. Example: --exclude tests/ migrations/ "**/__pycache__"',
    )

    # serve parser
    serve_parser = subparsers.add_parser(
        "serve", help="Serve an ALREADY generated visualizer output directory (does not re-parse)"
    )
    serve_parser.add_argument(
        "directory",
        nargs="?",
        default="glideit-out",
        help="Output directory to serve (default: glideit-out/)",
    )
    serve_parser.add_argument(
        "--port",
        "-p",
        type=int,
        default=8000,
        help="Port to start the local web server on (default: 8000)",
    )

    # archive parser
    archive_parser = subparsers.add_parser(
        "archive",
        help="Snapshot the current graph data into an archive entry",
    )
    archive_parser.add_argument(
        "--output",
        "-o",
        default="glideit-out",
        metavar="DIR",
        help="Output directory containing graph-data.json (default: glideit-out/)",
    )
    archive_parser.add_argument(
        "--name",
        "-n",
        type=str,
        default=None,
        metavar="LABEL",
        help="Optional human-friendly label for the archive (e.g. 'pre-refactor')",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    if args.command == "run":
        sys.exit(cmd_run(args))
    elif args.command == "serve":
        sys.exit(cmd_serve(args))
    elif args.command == "archive":
        sys.exit(cmd_archive(args))
