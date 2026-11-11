"""Small key-value store on disk so subjects, documents and progress survive across browsers."""

from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from typing import Any

STORE_DIR = Path(__file__).resolve().parents[2] / "data" / "store"
KEY_PATTERN = re.compile(r"^learn-for-exam:[a-z0-9:-]{1,80}$")

_lock = threading.Lock()


def valid_key(key: str) -> bool:
    return bool(KEY_PATTERN.match(key))


def _path(key: str) -> Path:
    return STORE_DIR / f"{key.replace(':', '__')}.json"


def read_all() -> dict[str, Any]:
    if not STORE_DIR.exists():
        return {}
    out: dict[str, Any] = {}
    for file in STORE_DIR.glob("*.json"):
        key = file.stem.replace("__", ":")
        if not valid_key(key):
            continue
        try:
            out[key] = json.loads(file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
    return out


def write(key: str, value: Any) -> None:
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    target = _path(key)
    tmp = target.with_suffix(".tmp")
    with _lock:
        tmp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, target)
