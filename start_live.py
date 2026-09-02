import subprocess
import re
import sys
import os
import time
import urllib.request

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

def is_backend_running():
    try:
        req = urllib.request.urlopen("http://localhost:8000/api/academic/metadata", timeout=1.5)
        return req.status == 200
    except Exception:
        return False

def main():
    print("=" * 68)
    print("   VisionAttend AI - Instant Cloudflare Tunnel Launcher")
    print("=" * 68)

    backend_proc = None
    if not is_backend_running():
        print("[*] Local backend server is not running. Starting python run.py...")
        backend_proc = subprocess.Popen(
            [sys.executable, "run.py"],
            cwd=PROJECT_DIR,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        print("[*] Waiting for server to initialize on http://localhost:8000 ...")
        for _ in range(20):
            time.sleep(1)
            if is_backend_running():
                print("[+] Backend server is ONLINE!")
                break
    else:
        print("[+] Backend server is already running on http://localhost:8000")

    print("[*] Generating high-speed Cloudflare secure HTTPS tunnel...")
    cmd = ["cloudflared", "tunnel", "--url", "http://localhost:8000"]
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    url_found = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    for line in proc.stdout:
        match = url_pattern.search(line)
        if match:
            url_found = match.group(0)
            break

    if url_found:
        try:
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{url_found}'"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            clipboard_msg = " [COPIED TO CLIPBOARD! Press Ctrl + V to share]"
        except Exception:
            clipboard_msg = ""

        print("\n" + "=" * 68)
        print("   >>> YOUR LIVE TEST LINK IS READY! <<<")
        print("=" * 68)
        print(f"\n   LIVE URL:  {url_found}")
        print(f"             {clipboard_msg}\n")
        print("   Credentials:")
        print("     - Admin:    admin     / admin123")
        print("     - Faculty:  dr_sharma / teacher123")
        print("\n   [*] Mobile Browser / Tablet / Any Device par open karein.")
        print("   [*] Press Ctrl + C to stop the tunnel.")
        print("=" * 68 + "\n")

        try:
            proc.wait()
        except KeyboardInterrupt:
            print("\n[*] Stopping Cloudflare Tunnel...")
            proc.terminate()
            if backend_proc:
                backend_proc.terminate()
            print("[+] Done.")
    else:
        print("[-] Could not retrieve tunnel URL. Cloudflare output:")
        try:
            proc.terminate()
        except Exception:
            pass

if __name__ == "__main__":
    main()
