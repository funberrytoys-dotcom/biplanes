"""Run a Blender script headlessly, so no GUI session has to be open.

    python tools/3d/blc.py tools/3d/run_plane.py TAG=sov MODE=cap

Any KEY=VALUE pairs replace the matching %KEY% placeholders in the script, and
the filled-in copy is written into the working directory before Blender gets it:
shell process substitution does not survive the trip on Windows.

Scene files, renders and sheets live in the working directory (.3dwork by
default, override with BIPLANES_3D_BASE); the pipeline modules are always read
from this folder.
"""
import subprocess, sys, os

BLENDER = os.environ.get("BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 4.4\blender.exe")
TOOLS = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("BIPLANES_3D_BASE", os.path.abspath(os.path.join(TOOLS, "..", "..", ".3dwork")))

script = sys.argv[1]
subs = dict(a.split("=", 1) for a in sys.argv[2:] if "=" in a)

os.makedirs(BASE, exist_ok=True)
src = open(script, encoding="utf-8").read()
if subs:
    for k, v in subs.items():
        src = src.replace("%%%s%%" % k, v)
    stem = os.path.splitext(os.path.basename(script))[0]
    script = os.path.join(BASE, "_run_%s_%s.py" % (stem, "_".join(subs.values())))
    open(script, "w", encoding="utf-8").write(src)

env = dict(os.environ, BIPLANES_3D_TOOLS=TOOLS, BIPLANES_3D_BASE=BASE)
p = subprocess.run([BLENDER, "--background", "--factory-startup", "--python", script],
                   capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
out = (p.stdout or "") + (p.stderr or "")
lines = [l for l in out.splitlines() if l.strip()]
print("\n".join(lines[-(40 if p.returncode else 14):]))
sys.exit(p.returncode)
