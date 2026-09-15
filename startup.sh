#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/api/health; then
  exit 0
fi
python3 - <<'PY' || true
import os, signal
def listening_inodes(port=8080):
    out=set()
    for path in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            f=open(path)
        except FileNotFoundError:
            continue
        with f:
            next(f)
            for line in f:
                parts=line.split()
                loc=parts[1]
                st=parts[3]
                inode=parts[9]
                p=int(loc.rsplit(":",1)[-1], 16)
                if p==port and st=="0A":
                    out.add(inode)
    return out
inodes=listening_inodes()
if not inodes:
    raise SystemExit
for pid in os.listdir("/proc"):
    if not pid.isdigit():
        continue
    fd=f"/proc/{pid}/fd"
    try:
        names=os.listdir(fd)
    except Exception:
        continue
    for name in names:
        try:
            tgt=os.readlink(f"{fd}/{name}")
        except Exception:
            continue
        if tgt.startswith("socket:[") and tgt[8:-1] in inodes:
            try:
                os.kill(int(pid), signal.SIGTERM)
            except Exception:
                pass
PY
sleep 0.4
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r requirements.txt
nohup .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8080 >>/tmp/app-startup.log 2>&1 &
i=0
while [ "$i" -lt 60 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/api/health; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.5
done
echo "Falha ao iniciar. Veja /tmp/app-startup.log" >&2
tail -n 50 /tmp/app-startup.log >&2 || true
exit 1
