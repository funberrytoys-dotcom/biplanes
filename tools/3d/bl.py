import socket, json, sys, os

HOST, PORT = "127.0.0.1", 9876

def send(cmd, params=None, timeout=600):
    s = socket.socket(); s.settimeout(timeout); s.connect((HOST, PORT))
    s.sendall(json.dumps({"type": cmd, "params": params or {}}).encode())
    buf = b""
    while True:
        try:
            ch = s.recv(1 << 20)
        except socket.timeout:
            break
        if not ch: break
        buf += ch
        try:
            json.loads(buf.decode()); break
        except Exception: continue
    s.close()
    try: return json.loads(buf.decode())
    except Exception: return {"status": "raw", "result": buf.decode(errors="replace")}

def run_code(code, timeout=5400):
    return send("execute_code", {"code": code}, timeout)

if __name__ == "__main__":
    path = sys.argv[1]
    code = open(path, encoding="utf-8").read()
    r = run_code(code)
    if r.get("status") == "success":
        res = r.get("result")
        if isinstance(res, dict):
            print(res.get("result", json.dumps(res, ensure_ascii=False)))
        else:
            print(res)
    else:
        print(json.dumps(r, ensure_ascii=False)[:6000])
