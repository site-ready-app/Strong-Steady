"""Strong & Steady reminder service for the iPhone/web version.

Runs on GitHub every 15 minutes. The web app sends its reminder settings (encrypted, so only this service can read
them) to a shared ntfy channel. This script reads them, and sends a reminder to the person's own private ntfy
channel at their exercise time, but only if: reminders are on, they're not unwell, they haven't exercised today,
and it's before their cut-off. At most two reminders a day, the second about 2.5 hours after the first.
Nothing personal is stored: just times, on/off, the last exercise date and the streak.
"""
import base64, json, os, sys, time, urllib.request, urllib.parse
from datetime import datetime
from zoneinfo import ZoneInfo
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

NTFY = "https://ntfy.sh"
REGISTRY = "strong-steady-reg-q7v2k9wx4m"       # must match REG_TOPIC in app/app.js
APP_URL = "https://site-ready-app.github.io/Strong-Steady/"
STATE = os.environ.get("STATE_FILE", "state/reminders.json")
KEEP_DAYS = 60


def private_key():
    raw = "".join(os.environ.get("KS", "").split())
    parts = raw.split(":")
    print(f"::notice::Secret received: {len(raw)} characters in {len(parts)} part(s) (expected about 5,200 characters in 3 parts).")
    if len(parts) < 3 or not parts[2]:
        print("::warning::The reminder key isn't in the STEADY_KEYSTORE_B64 secret yet, so reminders can't be read.")
        return None
    return serialization.load_der_private_key(base64.b64decode(parts[2]), password=None)


def http(method, url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers={"User-Agent": "StrongSteady-Reminders", **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def poll(since):
    url = f"{NTFY}/{REGISTRY}/json?poll=1&since={urllib.parse.quote(since)}"
    out = []
    for line in http("GET", url).splitlines():
        try:
            ev = json.loads(line)
            if ev.get("event") == "message":
                out.append(ev)
        except ValueError:
            pass
    return out


def decrypt(key, b64):
    plain = key.decrypt(base64.b64decode(b64), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    return json.loads(plain.decode("utf-8"))


def mins(hhmm, default):
    try:
        h, m = hhmm.split(":"); return int(h) * 60 + int(m)
    except Exception:
        return default


def send(topic, title, message, tags="muscle"):
    # title etc. go in the address (UTF-8 safe), because HTTP headers can't carry emoji
    q = urllib.parse.urlencode({"title": title, "tags": tags, "click": APP_URL, "priority": "4"})
    http("POST", f"{NTFY}/{topic}?{q}", data=message.encode("utf-8"))


def decide(cfg, now_local, sent_today):
    """Return (title, message) to send now, or None."""
    today = now_local.strftime("%Y-%m-%d")
    if cfg.get("n") != 1: return None
    ill = cfg.get("i", "")
    if ill == "open" or ill == today: return None
    if cfg.get("d") == today: return None
    now_m = now_local.hour * 60 + now_local.minute
    main, cut = mins(cfg.get("t", "10:30"), 630), mins(cfg.get("c", "16:00"), 960)
    if now_m < main or now_m >= cut: return None
    streak, stop = int(cfg.get("s") or 0), cfg.get("x") or ""
    if sent_today == 0:
        if streak > 1: msg = f"A short session keeps your {streak}-day streak going."
        elif stop: msg = f"A short session takes you half a mile nearer {stop}."
        else: msg = "Just a few minutes earns your first star today."
        return ("It's exercise time! ⭐", msg)
    if sent_today == 1 and now_m >= main + 150:
        return ("There's still time today", "Your exercise session is still waiting. It only takes a few minutes, and it unlocks today's games.")
    return None


def main():
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    try:
        state = json.load(open(STATE))
    except Exception:
        state = {"since": "12h", "users": {}}
    key = private_key()
    if key is None:
        return 0
    # 1. read new settings messages
    try:
        events = poll(state.get("since") or "12h")
    except Exception as e:
        print(f"::warning::Couldn't read the settings channel: {e}"); events = []
    for ev in events:
        state["since"] = ev["id"]
        try:
            cfg = decrypt(key, ev["message"].strip())
        except Exception:
            continue                                  # not ours, or tampered with: ignore
        u = cfg.get("u", "")
        if not (u.startswith("ss-") and 12 <= len(u) <= 40 and u.replace("-", "").isalnum()):
            continue
        if u.startswith("ss-test-") and not os.environ.get("SELFTEST"):
            continue                                  # self-test messages are only for the self-test
        rec = state["users"].setdefault(u, {"sent": {}})
        if cfg.get("v", 0) >= rec.get("cfg", {}).get("v", 0):
            rec["cfg"] = cfg
        rec["seen"] = time.time()
    # 2. send reminders that are due
    sent_now = 0
    for u, rec in list(state["users"].items()):
        if time.time() - rec.get("seen", 0) > KEEP_DAYS * 86400:
            del state["users"][u]; continue
        cfg = rec.get("cfg") or {}
        try:
            tz = ZoneInfo(cfg.get("z") or "Europe/London")
        except Exception:
            tz = ZoneInfo("Europe/London")
        now_local = datetime.now(tz)
        today = now_local.strftime("%Y-%m-%d")
        rec["sent"] = {d: n for d, n in rec.get("sent", {}).items() if d >= today}  # keep today only
        n = rec["sent"].get(today, 0)
        msg = decide(cfg, now_local, n)
        if msg:
            try:
                send(u, *msg); rec["sent"][today] = n + 1; sent_now += 1
            except Exception as e:
                print(f"::warning::A reminder couldn't be sent: {e}")
    json.dump(state, open(STATE, "w"))
    print(f"People with reminders: {len(state['users'])}. Settings messages read: {len(events)}. Reminders sent now: {sent_now}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
