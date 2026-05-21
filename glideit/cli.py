"""
GlideIt CLI entry point.

Usage:
    glideit run [--output ./custom-dir]
    glideit --version
    glideit --help
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from glideit import __version__

# ──────────────────────────────────────────────
# Colour helpers (no deps)
# ──────────────────────────────────────────────


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
        print(_red(f"[error] Repo root does not exist: {repo_root}"), file=sys.stderr)
        return 1

    print(_bold(_cyan("GlideIt") + " — scanning project..."))

    # ── Walk the directory ────────────────────
    walker = Walker(repo_root, exclude_patterns=args.exclude)
    py_files, jsx_files = walker.collect()

    print(f"  Parsing Python files...  ({_bold(str(len(py_files)))} found)")
    print(f"  Parsing JSX files...     ({_bold(str(len(jsx_files)))} found)")

    if not py_files and not jsx_files:
        print(_yellow("[notice] No parseable files found after filtering."))
        return 1

    # ── Extract nodes/edges ───────────────────
    assembler = GraphAssembler(repo_root)
    py_extractor = PythonExtractor(repo_root)
    jsx_extractor = JSXExtractor(repo_root)

    # Python
    for fp in py_files:
        try:
            source = fp.read_bytes()
            nodes, edges = py_extractor.extract(fp, source)
            assembler.add(nodes, edges)
        except Exception as exc:
            print(_yellow(f"  [warn] Skipping {fp.relative_to(repo_root)}: {exc}"))

    # JSX / JS / TSX
    for fp in jsx_files:
        try:
            source = fp.read_bytes()
            nodes, edges = jsx_extractor.extract(fp, source)
            assembler.add(nodes, edges)
        except Exception as exc:
            print(_yellow(f"  [warn] Skipping {fp.relative_to(repo_root)}: {exc}"))

    # ── Build graph JSON ──────────────────────
    print("  Building output...")
    output_dir.mkdir(parents=True, exist_ok=True)
    graph_json_path = output_dir / "graph-data.json"
    assembler.serialize(
        path=graph_json_path,
        file_count=len(py_files) + len(jsx_files),
        language_counts={"python": len(py_files), "jsx": len(jsx_files)},
    )

    # ── Renderer build ────────────────────────
    try:
        build_renderer(output_dir, graph_json_path, single_file=args.single)
    except Exception as exc:
        print(_yellow(f"  [warn] Renderer build failed: {exc}"))
        print(_yellow("  graph-data.json was written. You can build the renderer manually."))

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


# ──────────────────────────────────────────────
# Subcommand: serve & Local Web Server Logic
# ──────────────────────────────────────────────


def start_server(directory: Path, port: int = 8000) -> int:
    """Serve the output directory with a local HTTP server and open the browser."""
    import http.server
    import webbrowser
    from threading import Thread

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def log_message(self, format, *args):
            # Suppress request spam in the terminal
            pass

    attempts = 0
    actual_port = port
    server = None

    while attempts < 100:
        try:
            server = http.server.ThreadingHTTPServer(("", actual_port), Handler)
            break
        except OSError:
            actual_port += 1
            attempts += 1

    if server is None:
        print(_red("[error] Could not find a free port to bind the server."), file=sys.stderr)
        return 1

    print(_green(f"  Starting local server at http://localhost:{actual_port}"))
    print(_cyan("  Press Ctrl+C to stop the server."))

    def open_browser():
        time.sleep(0.5)
        webbrowser.open(f"http://localhost:{actual_port}")

    Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print(_bold(_cyan("\nServer stopped.")))
    finally:
        server.shutdown()
        server.server_close()
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    """Serve the generated visualization directory."""
    directory = Path(args.directory).resolve()
    if not directory.exists():
        print(_red(f"[error] Directory to serve does not exist: {directory}"), file=sys.stderr)
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
