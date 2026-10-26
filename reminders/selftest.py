"""End-to-end check, run by hand from GitHub (Actions -> Reminders -> Run workflow -> selftest).
Encrypts a test person's settings with the app's public key, posts them to the settings channel, runs the
reminder service, then reads the test person's channel to confirm the reminder arrived."""
import base64, json, os, random, string, sys, time
from datetime import datetime
from zoneinfo import ZoneInfo
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
os.environ["SELFTEST"] = "1"
import send as svc

pub = serialization.load_der_public_key(base64.b64decode(open(os.path.join(os.path.dirname(__file__), "public.b64")).read().strip()))
topic = "ss-test-" + "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(16))
now = datetime.now(ZoneInfo("Europe/London"))
start = (now.hour * 60 + now.minute - 2) % 1440
cfg = {"u": topic, "t": f"{start // 60:02d}:{start % 60:02d}", "c": "23:59", "n": 1, "i": "", "d": "", "z": "Europe/London", "s": 3, "x": "Housesteads", "v": int(time.time())}
blob = base64.b64encode(pub.encrypt(json.dumps(cfg, separators=(",", ":")).encode(), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))).decode()
svc.http("POST", f"{svc.NTFY}/{svc.REGISTRY}", data=blob.encode())
time.sleep(3)
os.environ["STATE_FILE"] = "/tmp/selftest-state.json"
svc.STATE = "/tmp/selftest-state.json"
svc.main()
time.sleep(3)
got = [json.loads(l) for l in svc.http("GET", f"{svc.NTFY}/{topic}/json?poll=1&since=5m").splitlines() if l.strip()]
msgs = [g for g in got if g.get("event") == "message"]
if msgs:
    print(f"::notice::Self-test passed: the reminder arrived (\"{msgs[0].get('title')}: {msgs[0].get('message')}\").")
    sys.exit(0)
print("::error::Self-test failed: no reminder arrived on the test channel.")
sys.exit(1)
