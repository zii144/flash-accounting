#!/usr/bin/env python3
import os
import re
import signal
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "captures", "ios26-iphone17-pro-max")
SCREENS = os.path.join(OUT, "screenshots")
LOG_PATH = os.path.join(ROOT, ".expo", "dev", "logs", "start.log")
BUNDLE_ID = "com.zii.flash.accounting"
METRO_URL = "exp+flash-accounting://expo-development-client/?url=http%3A%2F%2F192.168.0.238%3A8081"
EXPECTED = 18


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def hide_perf_monitor() -> None:
    result = run(["xcrun", "simctl", "get_app_container", "booted", BUNDLE_ID, "data"])
    prefs = os.path.join(result.stdout.strip(), "Library", "Preferences", f"{BUNDLE_ID}.plist")
    if not os.path.exists(prefs):
        return

    run(
        [
            "/usr/libexec/PlistBuddy",
            "-c",
            "Set :RCTDevMenu:RCTPerfMonitorKey false",
            prefs,
        ],
        check=False,
    )


def screenshot(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    run(["xcrun", "simctl", "io", "booted", "screenshot", path])


def main() -> int:
    os.makedirs(SCREENS, exist_ok=True)
    hide_perf_monitor()
    run(["xcrun", "simctl", "terminate", "booted", BUNDLE_ID], check=False)
    time.sleep(1)
    run(["xcrun", "simctl", "openurl", "booted", METRO_URL], check=False)

    captured: set[str] = set()
    deadline = time.time() + 240

    with open(LOG_PATH, "r", errors="ignore") as log:
        log.seek(0, os.SEEK_END)
        print("[capture-monitor] ready", flush=True)

        while time.time() < deadline:
            line = log.readline()
            if not line:
                time.sleep(0.1)
                continue

            match = re.search(r"\[capture:screenshot\]\s+(\w+)\s+(\w+)", line)
            if match:
                lang, page = match.groups()
                path = os.path.join(SCREENS, f"{lang}-{page}.png")
                time.sleep(0.15 if page != "settings" else 0.8)
                screenshot(path)
                captured.add(f"{lang}-{page}")
                print(f"[capture-monitor] screenshot {path}", flush=True)

            if "[capture:done]" in line:
                print("[capture-monitor] done", flush=True)
                break

    missing = EXPECTED - len(captured)
    if missing:
        print(f"[capture-monitor] warning: expected {EXPECTED}, captured {len(captured)}", file=sys.stderr)
        return 1

    print(f"[capture-monitor] success: {len(captured)} screenshots saved to {SCREENS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
