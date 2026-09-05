#!/usr/bin/env python3
"""Small local wrapper around the published Parro CLI."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import List

HOME = Path(os.environ.get("PARRO_HOME", os.environ.get("HOME", str(Path.home()))))
CLI = ["uvx", "--from", "parro[cli]", "parro"]
LAST_ATTACHMENTS = HOME / ".config" / "parro" / ".last_attachments"


def forward(args: List[str]) -> int:
    return subprocess.run(CLI + args).returncode


def load_attachment_urls() -> List[str]:
    if LAST_ATTACHMENTS.exists():
        return [url.strip() for url in LAST_ATTACHMENTS.read_text().splitlines() if url.strip()]
    return []


def resolve_ref(ref: str) -> str:
    if ref.isdigit():
        urls = load_attachment_urls()
        if not urls:
            raise RuntimeError("Geen bijlages gevonden. Run eerst `parro announcements`.")
        index = int(ref)
        if index < 1 or index > len(urls):
            raise RuntimeError(f"Nummer {index} bestaat niet. Beschikbaar: 1-{len(urls)}")
        return urls[index - 1]
    return ref


def download(url: str) -> Path:
    filename = url.split("/")[-1].split("?")[0] or "parro-attachment"
    target = Path(tempfile.gettempdir()) / f"parro-{filename}"
    request = urllib.request.Request(url, headers={"User-Agent": "Personal-Space-Parro/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        target.write_bytes(response.read())
    return target


def open_file(path: Path) -> None:
    opener_commands = [
        ["xdg-open", str(path)],
        ["gio", "open", str(path)],
        ["open", str(path)],
    ]
    for command in opener_commands:
        if shutil.which(command[0]):
            subprocess.run(command, check=False)
            return
    print(f"Geen opener gevonden; bestand opgeslagen op: {path}")


def main() -> int:
    args = sys.argv[1:]
    if not args:
        return forward([])
    if args[0] in {"open", "download"}:
        if len(args) < 2:
            print("Gebruik: parro.py open <ref> | parro.py download <ref>", file=sys.stderr)
            return 2
        try:
            path = download(resolve_ref(args[1]))
            print(f"Gedownload: {path}")
            if args[0] == "open":
                open_file(path)
            return 0
        except Exception as error:
            print(f"Parro wrapper fout: {error}", file=sys.stderr)
            return 1
    return forward(args)


if __name__ == "__main__":
    raise SystemExit(main())
