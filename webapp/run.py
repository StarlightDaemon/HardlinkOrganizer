#!/usr/bin/env python3
"""
Launcher for the Hardlink Organizer web application.

Usage:
    python webapp/run.py --config config.toml
    python webapp/run.py --config config.toml --host 0.0.0.0 --port 7700
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure the tool root (containing hardlink_organizer.py, engine/, webapp/) is importable.
_TOOL_DIR = Path(__file__).resolve().parent.parent
if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

from engine import __version__, load_config, ConfigError  # noqa: E402
from engine.db import Database  # noqa: E402
from webapp.app import create_app  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="hardlink-organizer-web",
        description=f"Hardlink Organizer — hosted web interface (v{__version__})",
    )
    parser.add_argument(
        "--config", "-c",
        required=True,
        metavar="PATH",
        help="Path to the TOML configuration file.",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        metavar="HOST",
        help="Host to bind (default: 0.0.0.0).",
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=7700,
        metavar="PORT",
        help="Port to listen on (default: 7700).",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload (development only).",
    )
    args = parser.parse_args(argv)

    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    db_path = cfg["paths"].get("db_file", "/tmp/hardlink-organizer/state.db")
    db = Database(db_path)

    app = create_app(cfg, db, args.config)

    print(f"\n  ╔══════════════════════════════════════════╗")
    _ver = __version__.ljust(9)
    print(f"  ║   Hardlink Organizer v{_ver}        ║")
    print(f"  ╚══════════════════════════════════════════╝")
    print(f"\n  → UI:      http://{args.host}:{args.port}")
    print(f"  → API:     http://{args.host}:{args.port}/api/docs")
    print(f"  → Config:  {args.config}")
    print(f"  → DB:      {db_path}\n")

    try:
        import uvicorn
    except ImportError:
        print("ERROR: uvicorn is not installed. Run: pip install uvicorn[standard]", file=sys.stderr)
        return 1

    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
