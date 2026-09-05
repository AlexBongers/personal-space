#!/usr/bin/env python3
"""Read Parro locally and send a sanitized snapshot to Personal Space."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
QNAP_HOME = Path("/opt/data/home")
QNAP_WRAPPER = Path("/opt/data/skills/productivity/parro/scripts/parro.py")
DEFAULT_PARRO_HOME = QNAP_HOME if QNAP_HOME.exists() else Path(os.environ.get("HOME", str(Path.home())))
DEFAULT_WRAPPER = QNAP_WRAPPER if QNAP_WRAPPER.exists() else BASE_DIR / "parro.py"
PARRO_HOME = Path(os.environ.get("PARRO_HOME", str(DEFAULT_PARRO_HOME)))
WRAPPER = Path(os.environ.get("PARRO_WRAPPER", str(DEFAULT_WRAPPER)))
DEFAULT_STATE_PATH = (
    PARRO_HOME / "cron" / "parro_watcher_state.json"
    if PARRO_HOME == QNAP_HOME
    else PARRO_HOME / ".config" / "parro" / "personal-space-state.json"
)
STATE_PATH = Path(os.environ.get("PARRO_STATE_PATH", str(DEFAULT_STATE_PATH)))
SYNC_ENV_PATH = Path(os.environ.get("PARRO_SYNC_ENV_FILE", str(PARRO_HOME / ".config" / "parro" / "personal-space-sync.env")))
MAX_ANNOUNCEMENTS = 20
MAX_CHATROOMS = 30


def parse_dt(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def iso_date(value: Any, fallback: str) -> str:
    parsed = parse_dt(value)
    return parsed.isoformat().replace("+00:00", "Z") if parsed != datetime.min.replace(tzinfo=timezone.utc) else fallback


def clean_text(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split()).strip()[:limit]


def integer(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    try:
        return max(0, min(999, int(value)))
    except (TypeError, ValueError):
        return 0


def as_list(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [entry for entry in value if isinstance(entry, dict)]


def run_parro(args: List[str]) -> Any:
    environment = os.environ.copy()
    environment["HOME"] = str(PARRO_HOME)
    command = [sys.executable, str(WRAPPER), "--json", *args]
    try:
        result = subprocess.run(command, capture_output=True, text=True, env=environment)
    except OSError as error:
        raise RuntimeError("Parro command could not be started") from error
    if result.returncode != 0:
        raise RuntimeError("Parro command failed")
    output = result.stdout.strip()
    if not output:
        return []
    try:
        return json.loads(output)
    except json.JSONDecodeError as error:
        raise RuntimeError("Parro returned invalid JSON") from error


def load_state() -> Dict[str, Any]:
    if not STATE_PATH.exists():
        return {"announcement_ts": "", "chatrooms": {}}
    try:
        value = json.loads(STATE_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return {"announcement_ts": "", "chatrooms": {}}
    return value if isinstance(value, dict) else {"announcement_ts": "", "chatrooms": {}}


def save_state(state: Dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_PATH.with_suffix(f"{STATE_PATH.suffix}.tmp")
    temporary.write_text(json.dumps(state, indent=2, ensure_ascii=False, sort_keys=True))
    temporary.replace(STATE_PATH)


def load_sync_env() -> None:
    if not SYNC_ENV_PATH.exists():
        return
    try:
        lines = SYNC_ENV_PATH.read_text().splitlines()
    except OSError:
        return
    for line in lines:
        key, separator, value = line.partition("=")
        key = key.strip()
        if separator and key in {"PARRO_SYNC_URL", "PARRO_SYNC_TOKEN"} and key not in os.environ:
            os.environ[key] = value.strip().strip("\"'")


def stable_id(prefix: str, value: str) -> str:
    return f"{prefix}:{hashlib.sha256(value.encode('utf-8')).hexdigest()[:32]}"


def source_id(entry: Dict[str, Any]) -> str:
    for key in ("id", "_id", "linkId"):
        value = entry.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    for link in entry.get("links", []) if isinstance(entry.get("links"), list) else []:
        if isinstance(link, dict) and link.get("id") is not None:
            return str(link["id"]).strip()
    return ""


def display_name(value: Any) -> str:
    if isinstance(value, str):
        return clean_text(value, 160)
    if isinstance(value, dict):
        for key in ("displayName", "name", "fullName"):
            result = clean_text(value.get(key), 160)
            if result:
                return result
    return ""


def announcement_message(announcement: Dict[str, Any], synced_at: str) -> Optional[Dict[str, Any]]:
    title = clean_text(announcement.get("title"), 240)
    if not title:
        return None
    published = iso_date(announcement.get("sortDate") or announcement.get("createdAt"), synced_at)
    raw_id = source_id(announcement) or f"{title}:{published}"
    owner = display_name(announcement.get("owner"))
    return {
        "id": stable_id("announcement", raw_id),
        "kind": "announcement",
        "title": title,
        "body": clean_text(announcement.get("contents") or announcement.get("text"), 1600),
        "sender": owner,
        "roomName": clean_text(announcement.get("_group_name") or announcement.get("groupName"), 240),
        "publishedAt": published,
        "unread": announcement.get("read") is not True,
        "unreadCount": 0 if announcement.get("read") is True else 1,
        "externalUrl": announcement.get("url") or announcement.get("link") or "",
    }


def latest_chat_message(room_id: str) -> Dict[str, Any]:
    messages = as_list(run_parro(["messages", room_id, "--limit", "5"]))
    if not messages:
        return {}
    return max(messages, key=lambda message: parse_dt(message.get("lastModifiedAt") or message.get("createdAt")))


def chatroom_message(room: Dict[str, Any], synced_at: str) -> Optional[Dict[str, Any]]:
    room_id = source_id(room)
    unread_count = integer(room.get("unreadCount"))
    if not room_id or unread_count < 1:
        return None
    name = clean_text(room.get("title") or room.get("subject") or room.get("name"), 240) or "Parro-chatroom"
    latest: Dict[str, Any] = {}
    try:
        latest = latest_chat_message(room_id)
    except RuntimeError:
        latest = {}
    message_date = latest.get("lastModifiedAt") or latest.get("createdAt")
    published = iso_date(message_date or room.get("sortDate") or room.get("lastModifiedAt"), synced_at)
    sender = display_name(latest.get("identity")) or display_name(latest.get("sender"))
    return {
        "id": stable_id("chatroom", room_id),
        "kind": "chatroom",
        "title": name,
        "body": clean_text(latest.get("text") or latest.get("contents"), 1600),
        "sender": sender,
        "roomName": name,
        "publishedAt": published,
        "unread": True,
        "unreadCount": unread_count,
        "externalUrl": "",
    }


def sync_url_is_safe(value: str) -> bool:
    parsed = urllib.parse.urlparse(value)
    return parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"})


def send_snapshot(url: str, token: str, messages: List[Dict[str, Any]], synced_at: str) -> None:
    if not sync_url_is_safe(url):
        raise RuntimeError("PARRO_SYNC_URL must use HTTPS")
    payload = json.dumps({"replace": True, "syncedAt": synced_at, "messages": messages}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Personal-Space-Parro-Sync/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError("Personal Space sync rejected")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError("Personal Space sync failed") from error


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sync Parro announcements and unread chatrooms to Personal Space.")
    parser.add_argument("--sync-url", default=os.environ.get("PARRO_SYNC_URL", ""))
    parser.add_argument("--sync-token", default=os.environ.get("PARRO_SYNC_TOKEN", ""))
    return parser


def main() -> int:
    load_sync_env()
    arguments = build_parser().parse_args()
    state = load_state()
    previous_announcement_ts = parse_dt(state.get("announcement_ts"))
    previous_chatrooms = state.get("chatrooms") if isinstance(state.get("chatrooms"), dict) else {}
    synced_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    announcements = as_list(run_parro(["announcements", "--limit", str(MAX_ANNOUNCEMENTS)]))
    chatrooms = as_list(run_parro(["chatrooms"]))
    messages: List[Dict[str, Any]] = []
    newest_announcement = previous_announcement_ts
    new_announcements = 0

    for announcement in announcements[:MAX_ANNOUNCEMENTS]:
        published = parse_dt(announcement.get("sortDate") or announcement.get("createdAt"))
        if published > previous_announcement_ts:
            new_announcements += 1
        if published > newest_announcement:
            newest_announcement = published
        normalized = announcement_message(announcement, synced_at)
        if normalized:
            messages.append(normalized)

    next_chatroom_state: Dict[str, Dict[str, Any]] = {}
    new_chatrooms = 0
    for room in chatrooms[:MAX_CHATROOMS]:
        room_id = source_id(room)
        if not room_id:
            continue
        name = clean_text(room.get("title") or room.get("subject") or room.get("name"), 240)
        sort_date = room.get("sortDate") or room.get("lastModifiedAt") or ""
        unread_count = integer(room.get("unreadCount"))
        next_chatroom_state[room_id] = {"name": name, "sortDate": sort_date, "unreadCount": unread_count}
        previous = previous_chatrooms.get(room_id) if isinstance(previous_chatrooms.get(room_id), dict) else {}
        changed = parse_dt(sort_date) > parse_dt(previous.get("sortDate")) or unread_count != integer(previous.get("unreadCount"))
        normalized = chatroom_message(room, synced_at)
        if normalized:
            messages.append(normalized)
            if changed:
                new_chatrooms += 1

    if arguments.sync_url:
        if not arguments.sync_token:
            raise RuntimeError("PARRO_SYNC_TOKEN is required when PARRO_SYNC_URL is set")
        send_snapshot(arguments.sync_url, arguments.sync_token, messages, synced_at)

    announcement_ts = "" if newest_announcement == datetime.min.replace(tzinfo=timezone.utc) else newest_announcement.isoformat().replace("+00:00", "Z")
    save_state({"announcement_ts": announcement_ts, "chatrooms": next_chatroom_state})

    if arguments.sync_url:
        print(f"Personal Space Parro sync completed: {len(messages)} items")
    elif new_announcements or new_chatrooms:
        print(f"Parro watcher found {new_announcements} new announcements and {new_chatrooms} changed chatrooms")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
