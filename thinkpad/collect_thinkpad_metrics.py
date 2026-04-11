#!/usr/bin/env python3

from __future__ import annotations

import base64
import getpass
import json
import locale
import os
import platform
import re
import subprocess
import time
from pathlib import Path


STATE_PATH = Path("/tmp/ubersicht-thinkpad-state.json")
STATIC_TTL_SECONDS = 6 * 60 * 60
UPDATE_TTL_SECONDS = 60 * 60
NETWORK_HISTORY_POINTS = 36
DEFAULT_IMAGE_PATH = "/Users/jinchiwei/arcadia/orchard/thinkpad/thinkpad deconstructed.deeppink-warmer-mid.png"


def run_command(command: list[str] | str, timeout: float = 1.5) -> str:
    try:
        completed = subprocess.run(
            command,
            shell=isinstance(command, str),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except Exception:
        return ""

    stdout = completed.stdout.strip()
    if stdout:
        return stdout
    return completed.stderr.strip() if completed.returncode == 0 else ""


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text())
    except Exception:
        return {}


def save_state(state: dict) -> None:
    try:
        STATE_PATH.write_text(json.dumps(state))
    except Exception:
        pass


def extract_field(blob: str, label: str) -> str:
    pattern = rf"^\s*{re.escape(label)}:\s*(.+)$"
    match = re.search(pattern, blob, re.MULTILINE)
    return match.group(1).strip() if match else ""


def parse_memory_string(memory_label: str) -> int:
    match = re.match(r"([\d.]+)\s*(GB|TB)", memory_label, re.IGNORECASE)
    if not match:
        return 0

    value = float(match.group(1))
    unit = match.group(2).upper()
    scale = 1024 ** 3 if unit == "GB" else 1024 ** 4
    return int(value * scale)


def format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    amount = float(max(value, 0))
    for unit in units:
        if amount < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(amount)}{unit}"
            return f"{amount:.1f}{unit}"
        amount /= 1024
    return "0B"


def format_rate(value: float) -> str:
    if value <= 0:
        return "0KB/s"
    return f"{value / 1024:.1f}KB/s" if value < 1024 ** 2 else f"{value / (1024 ** 2):.1f}MB/s"


def clamp_percent(value: float) -> float:
    return max(0.0, min(100.0, value))


def build_image_data_url(image_path: str) -> str:
    try:
        raw = Path(image_path).read_bytes()
    except Exception:
        return ""

    encoded = base64.b64encode(raw).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def get_static_info(state: dict) -> dict:
    cached = state.get("static_info", {})
    if cached and time.time() - cached.get("timestamp", 0) < STATIC_TTL_SECONDS:
        return cached["data"]

    hardware = run_command(["system_profiler", "SPHardwareDataType"], timeout=4.0)
    displays_json = run_command(["system_profiler", "SPDisplaysDataType", "-json"], timeout=4.0)
    sw_name = run_command(["sw_vers", "-productName"])
    sw_version = run_command(["sw_vers", "-productVersion"])
    build = run_command(["sw_vers", "-buildVersion"])

    gpu_name = "macOS GPU"
    gpu_cores = ""
    try:
        payload = json.loads(displays_json) if displays_json else {}
        cards = payload.get("SPDisplaysDataType", [])
        if cards:
            gpu_name = cards[0].get("sppci_model") or cards[0].get("_name") or gpu_name
            gpu_cores = cards[0].get("sppci_cores", "")
    except Exception:
        pass

    locale_value = run_command(["defaults", "read", "-g", "AppleLocale"]) or locale.getlocale()[0] or "en_US"
    model_name = extract_field(hardware, "Model Name") or "Mac"
    chip_name = extract_field(hardware, "Chip") or extract_field(hardware, "Processor Name") or platform.processor() or "Apple Silicon"
    memory_label = extract_field(hardware, "Memory") or "0 GB"
    memory_bytes = parse_memory_string(memory_label)
    cores_label = extract_field(hardware, "Total Number of Cores")
    perf_match = re.search(r"(\d+)\s+Performance", cores_label)
    eff_match = re.search(r"(\d+)\s+Efficiency", cores_label)
    total_match = re.match(r"(\d+)", cores_label)

    static = {
        "hostname": platform.node() or "mac",
        "user": getpass.getuser(),
        "os_name": sw_name or "macOS",
        "os_version": sw_version or platform.mac_ver()[0] or "unknown",
        "build": build or "",
        "kernel": platform.release(),
        "locale": locale_value,
        "model_name": model_name,
        "chip_name": chip_name,
        "gpu_name": gpu_name,
        "gpu_cores": gpu_cores,
        "memory_label": memory_label,
        "memory_bytes": memory_bytes,
        "cores_total": int(total_match.group(1)) if total_match else os.cpu_count() or 1,
        "cores_perf": int(perf_match.group(1)) if perf_match else 0,
        "cores_eff": int(eff_match.group(1)) if eff_match else 0,
        "cooling_label": "fanless chassis" if "air" in model_name.lower() else "sensor access unavailable",
    }

    state["static_info"] = {"timestamp": time.time(), "data": static}
    return static


def get_pending_updates(state: dict) -> dict:
    cached = state.get("updates_info", {})
    if cached and time.time() - cached.get("timestamp", 0) < UPDATE_TTL_SECONDS:
        return cached["data"]

    output = run_command("softwareupdate --list 2>/dev/null", timeout=4.0)
    count = None

    if output:
        if "No new software available" in output:
            count = 0
        else:
            labels = re.findall(r"^\s*\*\s+Label:", output, re.MULTILINE)
            count = len(labels) if labels else None

    data = {
        "count": count,
        "label": "scan timed out" if count is None else str(count),
    }

    state["updates_info"] = {"timestamp": time.time(), "data": data}
    return data


def parse_uptime() -> tuple[str, list[str]]:
    output = run_command(["uptime"])
    uptime_label = "unavailable"
    load_avg = ["-", "-", "-"]

    load_match = re.search(r"load averages?:\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)", output)
    if load_match:
        load_avg = [load_match.group(1), load_match.group(2), load_match.group(3)]

    if " up " in output:
        after_up = output.split(" up ", 1)[1]
        uptime_label = after_up.split(",", 1)[0].strip()

    return uptime_label, load_avg


def parse_vm_stats() -> dict:
    output = run_command(["vm_stat"])
    page_size_match = re.search(r"page size of (\d+) bytes", output)
    page_size = int(page_size_match.group(1)) if page_size_match else 4096

    stats: dict[str, int] = {}
    for line in output.splitlines():
        match = re.match(r"(.+?):\s+([\d.]+)\.", line)
        if match:
            stats[match.group(1).strip()] = int(float(match.group(2)))

    return {
        "page_size": page_size,
        "free": stats.get("Pages free", 0),
        "speculative": stats.get("Pages speculative", 0),
        "wired": stats.get("Pages wired down", 0),
        "active": stats.get("Pages active", 0),
        "inactive": stats.get("Pages inactive", 0),
        "purgeable": stats.get("Pages purgeable", 0),
        "compressed": stats.get("Pages occupied by compressor", 0),
    }


def get_memory_info(total_bytes: int) -> dict:
    vm_stats = parse_vm_stats()
    page_size = vm_stats["page_size"]

    available_pages = vm_stats["free"] + vm_stats["speculative"] + vm_stats["purgeable"]
    available_bytes = available_pages * page_size
    used_bytes = max(total_bytes - available_bytes, 0) if total_bytes else 0
    percent = clamp_percent((used_bytes / total_bytes) * 100.0) if total_bytes else 0.0

    return {
        "used_bytes": used_bytes,
        "total_bytes": total_bytes,
        "used_label": format_bytes(used_bytes),
        "total_label": format_bytes(total_bytes),
        "percent": round(percent, 1),
    }


def get_cpu_info(static_info: dict, load_avg: list[str]) -> dict:
    cpu_sum = run_command("ps -A -o %cpu= 2>/dev/null | awk '{s += $1} END {printf \"%.1f\\n\", s}'")
    total_cores = max(static_info.get("cores_total", 1), 1)

    cpu_percent = None
    try:
        cpu_percent = clamp_percent(float(cpu_sum) / total_cores)
    except Exception:
        pass

    if cpu_percent is None and load_avg[0] != "-":
        try:
            cpu_percent = clamp_percent((float(load_avg[0]) / total_cores) * 100.0)
        except Exception:
            cpu_percent = 0.0

    return {
        "percent": round(cpu_percent or 0.0, 1),
        "chip": static_info["chip_name"],
        "perf_cores": static_info["cores_perf"],
        "eff_cores": static_info["cores_eff"],
        "total_cores": total_cores,
        "load_avg": load_avg,
    }


def parse_battery() -> dict:
    output = run_command(["pmset", "-g", "batt"])
    source = "battery"
    percent = None
    status = "unknown"
    eta = "--:--"

    lines = [line for line in output.splitlines() if line.strip()]
    if lines:
        first = lines[0].strip()
        if "AC Power" in first:
            source = "AC"
        elif "Battery Power" in first:
            source = "BAT"

    if len(lines) > 1:
        payload = lines[1].split("\t", 1)[-1]
        percent_match = re.search(r"(\d+)%", payload)
        if percent_match:
            percent = int(percent_match.group(1))

        fields = [field.strip() for field in payload.split(";")]
        if len(fields) >= 2:
            status = fields[1]
        if len(fields) >= 3 and fields[2]:
            eta = fields[2].split(" present:", 1)[0].strip()

    label = f"{percent if percent is not None else '--'}% {status} / {source}"
    return {"percent": percent or 0, "status": status, "source": source, "eta": eta, "label": label}


def parse_ifconfig() -> dict:
    output = run_command(["ifconfig"], timeout=2.0)
    interfaces: list[dict] = []
    current: dict | None = None

    for line in output.splitlines():
        if line and not line.startswith("\t") and not line.startswith(" "):
            name = line.split(":", 1)[0]
            current = {"name": name, "status": "inactive", "ipv4": "", "blocks": []}
            interfaces.append(current)
        elif current is not None:
            current["blocks"].append(line)
            inet_match = re.search(r"\sinet\s+(\d+\.\d+\.\d+\.\d+)", line)
            if inet_match and not inet_match.group(1).startswith("127."):
                current["ipv4"] = inet_match.group(1)
            status_match = re.search(r"\sstatus:\s+(\w+)", line)
            if status_match:
                current["status"] = status_match.group(1)

    preferred = [
        iface for iface in interfaces
        if iface["status"] == "active" and iface["ipv4"] and re.match(r"^en\d+$", iface["name"])
    ]
    if preferred:
        return preferred[0]

    fallback = [
        iface for iface in interfaces
        if iface["status"] == "active" and iface["ipv4"]
    ]
    return fallback[0] if fallback else {"name": "offline", "status": "inactive", "ipv4": ""}


def parse_net_bytes(interface_name: str) -> tuple[int, int]:
    output = run_command(["netstat", "-ibn"], timeout=1.5)
    if not output:
        return 0, 0

    lines = output.splitlines()
    header_index = next((idx for idx, line in enumerate(lines) if line.startswith("Name")), None)
    if header_index is None:
        return 0, 0

    headers = lines[header_index].split()
    try:
        ib_idx = headers.index("Ibytes")
        ob_idx = headers.index("Obytes")
    except ValueError:
        return 0, 0

    rx = 0
    tx = 0
    for line in lines[header_index + 1:]:
        parts = line.split()
        if not parts or parts[0] != interface_name:
            continue
        try:
            rx = max(rx, int(parts[ib_idx]))
            tx = max(tx, int(parts[ob_idx]))
        except Exception:
            continue

    return rx, tx


def build_network_info(state: dict) -> dict:
    iface = parse_ifconfig()
    timestamp = time.time()
    rx_bytes, tx_bytes = parse_net_bytes(iface["name"]) if iface["name"] != "offline" else (0, 0)

    previous = state.get("network_state", {})
    previous_iface = previous.get("iface")
    previous_rx = previous.get("rx_bytes", 0)
    previous_tx = previous.get("tx_bytes", 0)
    previous_ts = previous.get("timestamp", timestamp)

    rx_rate = 0.0
    tx_rate = 0.0
    if previous_iface == iface["name"] and timestamp > previous_ts:
        interval = timestamp - previous_ts
        rx_rate = max((rx_bytes - previous_rx) / interval, 0.0)
        tx_rate = max((tx_bytes - previous_tx) / interval, 0.0)

    rx_history = list(previous.get("rx_history", []))
    tx_history = list(previous.get("tx_history", []))
    rx_history.append(round(rx_rate, 2))
    tx_history.append(round(tx_rate, 2))
    rx_history = rx_history[-NETWORK_HISTORY_POINTS:]
    tx_history = tx_history[-NETWORK_HISTORY_POINTS:]

    state["network_state"] = {
        "iface": iface["name"],
        "timestamp": timestamp,
        "rx_bytes": rx_bytes,
        "tx_bytes": tx_bytes,
        "rx_history": rx_history,
        "tx_history": tx_history,
    }

    status = "online" if iface["name"] != "offline" else "offline"
    return {
        "status": status,
        "iface": iface["name"],
        "ip": iface.get("ipv4", ""),
        "rx_rate": round(rx_rate, 1),
        "tx_rate": round(tx_rate, 1),
        "rx_label": format_rate(rx_rate),
        "tx_label": format_rate(tx_rate),
        "rx_history": rx_history,
        "tx_history": tx_history,
    }


def parse_df_entry(target: str, label: str) -> dict | None:
    output = run_command(["df", "-k", target])
    lines = [line for line in output.splitlines() if line.strip()]
    if len(lines) < 2:
        return None

    parts = lines[1].split()
    if len(parts) < 6:
        return None

    total_bytes = int(parts[1]) * 1024
    used_bytes = int(parts[2]) * 1024
    available_bytes = int(parts[3]) * 1024
    percent = int(parts[4].rstrip("%"))

    return {
        "label": label,
        "mount": target,
        "total_bytes": total_bytes,
        "used_bytes": used_bytes,
        "available_bytes": available_bytes,
        "used_label": format_bytes(used_bytes),
        "total_label": format_bytes(total_bytes),
        "percent": percent,
    }


def get_storage_info() -> list[dict]:
    entries: list[dict] = []
    home_path = str(Path.home())

    for target, label in [
        ("/", "/"),
        ("/System/Volumes/Data", "/DATA"),
        (home_path, "/HOME"),
    ]:
        entry = parse_df_entry(target, label)
        if entry:
            entries.append(entry)

    volumes = Path("/Volumes")
    try:
        for volume in sorted(volumes.iterdir()):
            if not volume.is_dir():
                continue
            if volume.name.startswith("Macintosh HD"):
                continue
            entry = parse_df_entry(str(volume), f"/{volume.name.upper()[:12]}")
            if entry:
                entries.append(entry)
                break
    except Exception:
        pass

    return entries


def main() -> None:
    state = load_state()
    static_info = get_static_info(state)
    image_path = os.environ.get("THINKPAD_IMAGE_PATH", DEFAULT_IMAGE_PATH)
    updates = get_pending_updates(state)
    uptime_label, load_avg = parse_uptime()
    memory = get_memory_info(static_info["memory_bytes"])
    cpu = get_cpu_info(static_info, load_avg)
    battery = parse_battery()
    network = build_network_info(state)
    storage = get_storage_info()

    payload = {
        "meta": {
            **static_info,
            "image_data_url": build_image_data_url(image_path),
        },
        "updates": updates,
        "uptime": uptime_label,
        "memory": memory,
        "cpu": cpu,
        "network": network,
        "battery": battery,
        "storage": storage,
        "thermals": {
            "cooling": static_info["cooling_label"],
            "sensor_note": "macOS sensor access unavailable",
        },
        "audio": {
            "label": "unavailable",
        },
        "timestamp": int(time.time()),
    }

    save_state(state)
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
