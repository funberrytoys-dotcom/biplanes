"""Run a Blender script headlessly, so no GUI session has to be open."""
import subprocess, sys, os
BLENDER = r"C:\Program Files\Blender Foundation\Blender 4.4\blender.exe"
script = sys.argv[1]
p = subprocess.run([BLENDER, "--background", "--factory-startup", "--python", script],
                   capture_output=True, text=True, encoding="utf-8", errors="replace")
out = (p.stdout or "") + (p.stderr or "")
lines = [l for l in out.splitlines() if l.strip()]
tail = lines[-14:] if lines else []
print("\n".join(tail))
sys.exit(p.returncode)
