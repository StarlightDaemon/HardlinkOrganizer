#!/usr/bin/env python3
"""Verify a candidate or digest-pulled Docker image using disposable fixtures."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
import uuid


def docker(*args: str) -> str:
    result = subprocess.run(
        ["docker", *args], check=True, text=True, capture_output=True,
    )
    return result.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("--version", required=True)
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()

    info = json.loads(docker("image", "inspect", args.image))[0]
    assert info["Os"] == "linux" and info["Architecture"] == "amd64", info
    labels = info["Config"]["Labels"]
    assert labels["org.opencontainers.image.version"] == args.version, labels
    assert labels["org.opencontainers.image.revision"] == args.revision, labels

    # Exercise the actual entrypoint's defaults without bind mounts.
    docker(
        "run", "--rm", args.image, "python", "-c",
        "import os; from pathlib import Path; assert os.geteuid() == 1000; "
        "assert os.getegid() == 1000; "
        "assert not Path('/app/webapp/frontend/node_modules').exists(); "
        "assert not any(__import__('importlib.util', fromlist=['find_spec']).find_spec(name) "
        "for name in ('pip', 'setuptools', 'ensurepip'))",
    )

    uid, gid = os.getuid(), os.getgid()
    assert uid != 0, "Run the host verifier as a nonroot user."
    name = "hlo-final-smoke-" + uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix="hlo-final-smoke-") as temporary:
        root = Path(temporary)
        config, data = root / "config", root / "data"
        config.mkdir()
        ingress, library, outside = data / "ingress", data / "library", data / "outside"
        for directory in (ingress, library, outside, ingress / "Show" / "Extras", library / "Show"):
            directory.mkdir(parents=True, exist_ok=True)
        source = ingress / "movie.mkv"
        source.write_text("original media payload", encoding="utf-8")
        (ingress / "Show" / "episode.mkv").write_text("episode", encoding="utf-8")
        (ingress / "Show" / "Extras" / "bonus.mkv").write_text("bonus", encoding="utf-8")
        (library / "Show" / "Extras").symlink_to("/data/outside", target_is_directory=True)
        (config / "config.toml").write_text(
            '[paths]\ndb_file = "/config/history.db"\n'
            'index_json = "/config/index.json"\nindex_tsv = "/config/index.tsv"\n'
            '[settings]\ninclude_hidden = false\ncollision_policy = "skip"\n'
            '[source_sets]\nmovies = "/data/ingress"\n'
            '[dest_sets]\nmovies = "/data/library"\n',
            encoding="utf-8",
        )

        started = False
        try:
            docker(
                "run", "-d", "--name", name, "-p", "127.0.0.1::7700",
                "--mount", f"type=bind,src={config},dst=/config",
                "--mount", f"type=bind,src={data},dst=/data",
                "-e", f"PUID={uid}", "-e", f"PGID={gid}", args.image,
            )
            started = True
            address = docker("port", name, "7700/tcp").splitlines()[0]
            base = "http://" + address

            def request(path: str, body: dict | None = None):
                raw = None if body is None else json.dumps(body).encode()
                query = Request(
                    base + path, data=raw,
                    headers={"Content-Type": "application/json"} if raw else {},
                )
                with urlopen(query, timeout=10) as response:
                    content = response.read()
                    if "application/json" in response.headers.get("Content-Type", ""):
                        return json.loads(content)
                    return content.decode()

            for attempt in range(60):
                try:
                    health = request("/health")
                    break
                except (URLError, ConnectionError, TimeoutError):
                    time.sleep(0.5)
            else:
                raise AssertionError("Container did not become healthy.")

            assert health["version"] == args.version, health
            assert health["config_loaded"] and health["db_connected"], health
            status = docker("exec", name, "cat", "/proc/1/status")
            uid_fields = next(line.split()[1:] for line in status.splitlines() if line.startswith("Uid:"))
            gid_fields = next(line.split()[1:] for line in status.splitlines() if line.startswith("Gid:"))
            assert all(int(value) == uid for value in uid_fields), status
            assert all(int(value) == gid for value in gid_fields), status

            html = request("/")
            assert "<!doctype html" in html.lower(), html
            assets = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
            assert assets, html
            for asset in assets:
                assert request(asset), asset

            scan = request("/api/scan", {"source_set": "movies"})
            assert scan["total_entries"] == 2, scan
            payload = {
                "source_set": "movies", "full_path": "/data/ingress/movie.mkv",
                "dest_set": "movies", "dest_subpath": "linked.mkv",
            }
            assert request("/api/preview", payload)["valid"]
            dry_run = request("/api/execute", dict(payload, dry_run=True))
            assert dry_run["success"] and dry_run["linked"] == 1, dry_run
            assert not (library / "linked.mkv").exists()
            linked = request("/api/execute", dict(payload, dry_run=False))
            assert linked["success"] and linked["linked"] == 1, linked
            assert os.path.samefile(source, library / "linked.mkv")
            collision = request("/api/execute", dict(payload, dry_run=False))
            assert collision["success"] and collision["linked"] == 0 and collision["skipped"] == 1, collision

            tree = request("/api/execute", {
                "source_set": "movies", "full_path": "/data/ingress/Show",
                "dest_set": "movies", "dest_subpath": "Show", "dry_run": False,
            })
            assert not tree["success"] and tree["failed"] == 1 and tree["linked"] == 1, tree
            assert list(outside.iterdir()) == [], "Destination symlink redirected a write."
            assert os.path.samefile(ingress / "Show" / "episode.mkv", library / "Show" / "episode.mkv")
            assert source.read_text(encoding="utf-8") == "original media payload"
            assert (ingress / "Show" / "Extras" / "bonus.mkv").read_text(encoding="utf-8") == "bonus"
            assert (config / "history.db").is_file()
            print("PASS: labels/platform, default and custom UID/GID, HTTP health/SPA/assets,")
            print("scan/preview/dry-run/hardlink/collision, source preservation, symlink refusal.")
        except Exception:
            if started:
                print(docker("logs", name))
            raise
        finally:
            if started:
                docker("rm", "-f", name)


if __name__ == "__main__":
    main()
