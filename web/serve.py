#!/usr/bin/env python3
"""Serve the game on 127.0.0.1 and a same-origin KOA flight feed.

The feed is OpenSky's record of aircraft that used PHKO since local midnight,
plus ADS-B aircraft currently within 20 km of the field. It is not an airline
schedule of flights still to come. Nothing is invented when a source fails.
"""
from __future__ import annotations

import json
import math
import re
import threading
import time
import urllib.error
import urllib.request
from html import unescape
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent / "public"
HOST = "127.0.0.1"
PORT = 8800
HST = ZoneInfo("Pacific/Honolulu")
KOA = (19.7388, -156.0456)
CACHE_S = 90
LOG = Path(__file__).resolve().parent / ".koa-day.json"
_lock = threading.Lock()
_cache = {"at": 0.0, "body": None}
_history_block_until = 0.0


def _get_text(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "kona-local/0.3"})
    try:
        with urllib.request.urlopen(req, timeout=12) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read()[:200].decode("utf-8", "replace")
    except Exception as err:  # noqa: BLE001 — surface the failure, do not invent rows
        return 0, str(err)


def _cell(pattern: str, html: str) -> str:
    match = re.search(pattern, html, re.S)
    if not match:
        return ""
    text = re.sub(r"<[^>]+>", "", match.group(1))
    return unescape(text).replace("\xa0", " ").strip()


def _minutes(clock: str) -> int:
    match = re.match(r"(\d{1,2}):(\d{2})\s*([AP]M)", clock or "", re.I)
    if not match:
        return 0
    hour, minute, ap = int(match.group(1)), int(match.group(2)), match.group(3).upper()
    if ap == "PM" and hour != 12:
        hour += 12
    if ap == "AM" and hour == 12:
        hour = 0
    return hour * 60 + minute


def _fids(kind: str):
    init = "arrivals" if kind == "arrival" else "departures"
    url = (
        "https://tracker.flightview.com/FVAccess2/tools/fids/fidsDefault.asp"
        f"?accCustId=FVWebFids&fidsApt=koa&fidsId=20001&fidsInit={init}"
    )
    code, text = _get_text(url)
    if code != 200 or "fvData" not in text:
        return [], f"KOA board {init} {code or 'down'}"
    body = text.split('id="fvData"', 1)[1]
    rows = []
    # Outer rows are class odd/even. Nested airline markup has plain <tr>, so do not stop at the first </tr>.
    for tr in re.split(r'<tr class="(?:odd|even)">', body)[1:]:
        airline = _cell(r'ffAlLbl">(.*?)</td>', tr)
        al = re.search(r'ffWrAlLg\("([A-Z0-9]{2})"\)', tr)
        flight = _cell(r'class="c2">(.*?)</td>', tr)
        city = _cell(r'class="c3">(.*?)</td>', tr)
        status = _cell(r"<a [^>]*>(.*?)</a>", tr)
        times = [
            unescape(item).replace("\xa0", " ").strip()
            for item in re.findall(r"-->\s*([^<]+)</td>", tr)
        ]
        sched = times[0] if times else ""
        updated = times[1] if len(times) > 1 else ""
        callsign = f"{al.group(1) if al else ''} {flight}".strip() or "—"
        if kind == "arrival":
            origin, dest = city or "—", "KOA"
        else:
            origin, dest = "KOA", city or "—"
        clock = f"{sched} · {updated}".strip(" ·") if updated and updated != sched else (sched or updated)
        rows.append({
            "callsign": callsign,
            "airline": airline,
            "from": origin,
            "to": dest,
            "status": status or "—",
            "time": clock,
            "sort": _minutes(sched or updated),
            "leg": "in" if kind == "arrival" else "out",
            "board": True,
        })
    return rows, ""


def _get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "kona-local/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as err:
        raw = err.read()[:240]
        return err.code, raw.decode("utf-8", "replace")
    except Exception as err:  # noqa: BLE001 — surface the failure, do not invent rows
        return 0, str(err)


def _hst(ts):
    if not ts:
        return ""
    return datetime.fromtimestamp(int(ts), HST).strftime("%H:%M")


def _bearing(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _ang(a, b):
    return abs((a - b + 180) % 360 - 180)


def _live_status(lat, lon, alt, on_ground, velocity, track):
    if on_ground:
        return "On the ground at KOA"
    toward = _bearing(lat, lon, KOA[0], KOA[1])
    moving = isinstance(velocity, (int, float)) and velocity > 20 and isinstance(track, (int, float))
    if moving and _ang(track, toward) < 50:
        status = "Arriving"
    elif moving and _ang(track, (toward + 180) % 360) < 50:
        status = "Departing"
    else:
        status = "Airborne nearby"
    if isinstance(alt, (int, float)):
        status += f" · {int(alt)} m"
    return status


def _km(lat, lon):
    r = 6371.0
    p1, p2 = math.radians(KOA[0]), math.radians(lat)
    dphi = math.radians(lat - KOA[0])
    dl = math.radians(lon - KOA[1])
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _rows():
    now = datetime.now(HST)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    begin, end = int(start.timestamp()), int(now.timestamp())
    rows = []
    errors = []
    board = []
    for kind in ("arrival", "departure"):
        got, err = _fids(kind)
        board.extend(got)
        if err:
            errors.append(err)
    if board:
        rows.extend(board)
    code, data = _get(
        "https://opensky-network.org/api/states/all?lamin=19.55&lomin=-156.25&lamax=19.95&lomax=-155.75"
    )
    if code == 200 and isinstance(data, dict):
        for state in data.get("states") or []:
            lon, lat = state[5], state[6]
            if lat is None or lon is None or _km(lat, lon) > 20:
                continue
            alt = state[7]
            status = _live_status(lat, lon, alt, bool(state[8]), state[9], state[10])
            callsign = (state[1] or "").strip() or "—"
            number = re.sub(r"\D", "", callsign).lstrip("0")
            on_board = bool(number) and not callsign.startswith("N") and any(
                re.sub(r"\D", "", item["callsign"]).lstrip("0") == number for item in board
            )
            if on_board:
                continue
            rows.append({
                "callsign": callsign,
                "from": "—",
                "to": "KOA area",
                "status": status,
                "time": _hst(state[4]),
                "sort": 2000 + (state[4] or 0) % 1000,
                "leg": "field",
            })
    else:
        errors.append(f"OpenSky live {code or 'down'}")
    global _history_block_until
    if time.time() < _history_block_until:
        errors.append("OpenSky history withheld")
    else:
        withheld = False
        for kind, status in (("arrival", "Arrived"), ("departure", "Departed")):
            code, data = _get(
                f"https://opensky-network.org/api/flights/{kind}?airport=PHKO&begin={begin}&end={end}"
            )
            if code == 404:
                continue
            if code == 403:
                withheld = True
                continue
            if code != 200 or not isinstance(data, list):
                errors.append(f"OpenSky {kind} {code or 'down'}")
                continue
            for flight in data:
                when = flight.get("lastSeen") if kind == "arrival" else flight.get("firstSeen")
                rows.append({
                    "callsign": (flight.get("callsign") or "").strip() or "—",
                    "from": flight.get("estDepartureAirport") or "—",
                    "to": flight.get("estArrivalAirport") or "—",
                    "status": status,
                    "time": _hst(when),
                    "sort": when or 0,
                })
        if withheld:
            _history_block_until = time.time() + 900
            errors.append("OpenSky history withheld")
    code, data = _get("https://api.adsb.lol/v2/lat/19.7388/lon/-156.0456/dist/20")
    if code == 200 and isinstance(data, dict):
        for craft in data.get("ac") or []:
            lat, lon = craft.get("lat"), craft.get("lon")
            if lat is None or lon is None or _km(lat, lon) > 20:
                continue
            alt = craft.get("alt_baro")
            ground = alt in ("ground", 0, None) or (isinstance(alt, (int, float)) and alt < 150)
            rows.append({
                "callsign": (craft.get("flight") or craft.get("r") or "—").strip(),
                "from": "—",
                "to": "KOA",
                "status": "At the field" if ground else "Airborne nearby",
                "time": now.strftime("%H:%M"),
                "sort": end,
            })
    elif code:
        errors.append(f"ADS-B {code}")
    day = start.date().isoformat()
    log = _load_log(day)
    live = set()
    for row in rows:
        cs = row["callsign"]
        if not cs or cs == "—" or not _usable(row):
            continue
        live.add(cs)
        prev = log["seen"].get(cs, {})
        log["seen"][cs] = {
            "callsign": cs,
            "from": row["from"] if row["from"] != "—" else prev.get("from", "—"),
            "to": row["to"] if row["to"] != "—" else prev.get("to", "—"),
            "status": row["status"],
            "time": row["time"],
            "sort": row.get("sort", 0),
        }
    for cs, prev in log["seen"].items():
        if cs in live or not _usable(prev):
            continue
        rows.append({
            "callsign": cs,
            "from": prev.get("from", "—"),
            "to": prev.get("to", "—"),
            "status": "Seen earlier · " + (prev.get("status") or ""),
            "time": prev.get("time", ""),
            "sort": prev.get("sort", 0),
        })
    _save_log(log)
    rows.sort(key=lambda row: row["sort"], reverse=True)
    for row in rows:
        row.pop("sort", None)
    return {
        "airport": "PHKO",
        "localDay": day,
        "fetchedAt": now.isoformat(timespec="minutes"),
        "seenToday": len(log["seen"]),
        "source": "Hawaii airports FlightView board for KOA, plus OpenSky aircraft at the field whose flight is not already on that board.",
        "note": "Today’s KOA board: airline, flight, city, and the status the airport page published. A dash is a live aircraft at the field with no route on that board.",
        "error": "; ".join(errors),
        "rows": rows,
    }


def _usable(row):
    status = row.get("status") or ""
    if status in ("", "—") or status.endswith("—"):
        return False
    places = (row.get("from"), row.get("to"))
    if places[0] in (None, "", "—") and places[1] in (None, "", "—", "KOA", "KOA area"):
        return False
    return True


def _load_log(day):
    try:
        data = json.loads(LOG.read_text())
    except (OSError, json.JSONDecodeError):
        data = {"localDay": day, "seen": {}}
    if data.get("localDay") != day or not isinstance(data.get("seen"), dict):
        data = {"localDay": day, "seen": {}}
    return data


def _save_log(data):
    LOG.write_text(json.dumps(data))


def feed():
    now = time.time()
    with _lock:
        if _cache["body"] and now - _cache["at"] < CACHE_S:
            return _cache["body"]
    body = _rows()
    with _lock:
        if body.get("rows") or not body.get("error"):
            _cache["at"] = time.time()
            _cache["body"] = body
    return body


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/koa-flights":
            raw = json.dumps(feed()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        super().do_GET()


def main():
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Kona on http://{HOST}:{PORT}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
