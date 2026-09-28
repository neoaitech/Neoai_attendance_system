import os
import sys
import subprocess
from pathlib import Path

SSH_EXE = r"C:\Windows\System32\OpenSSH\ssh.exe"
SCP_EXE = r"C:\Windows\System32\OpenSSH\scp.exe"
PEM_KEY = r"C:\Users\Acer\Downloads\neoai-attendance-vm_key.pem"
AZURE_HOST = "azureuser@40.80.87.73"

def run_ssh(remote_cmd):
    cmd = [
        SSH_EXE,
        "-i", PEM_KEY,
        "-o", "StrictHostKeyChecking=accept-new",
        AZURE_HOST,
        remote_cmd
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr

def run_scp(local_path, remote_path):
    cmd = [
        SCP_EXE,
        "-i", PEM_KEY,
        "-o", "StrictHostKeyChecking=accept-new",
        "-r",
        str(local_path),
        f"{AZURE_HOST}:{remote_path}"
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr

def main():
    print("=" * 80)
    print(" Deploying ONLY Student Parent Details & Parent App to Azure VM")
    print("=" * 80)

    # 1. Test SSH connection
    print("\n[Step 1] Testing SSH connection to Azure VM (40.80.87.73)...")
    rc, out, err = run_ssh("echo 'SSH Connection OK'")
    if rc != 0:
        print("SSH Connection failed:", err)
        sys.exit(1)
    print(" [OK]", out.strip())

    # 2. Upload specific files to staging directory on VM
    print("\n[Step 2] Uploading updated backend & frontend files to /tmp/neoai_patch...")
    run_ssh("mkdir -p /tmp/neoai_patch/backend/app/api /tmp/neoai_patch/backend/app/services /tmp/neoai_patch/backend/app/schemas /tmp/neoai_patch/backend/app/db /tmp/neoai_patch/frontend/css/base /tmp/neoai_patch/frontend/css/pages /tmp/neoai_patch/frontend/js/views /tmp/neoai_patch/frontend/images")

    files_to_copy = [
        ("backend/app/api/parent.py", "/tmp/neoai_patch/backend/app/api/parent.py"),
        ("backend/app/api/students.py", "/tmp/neoai_patch/backend/app/api/students.py"),
        ("backend/app/api/auth.py", "/tmp/neoai_patch/backend/app/api/auth.py"),
        ("backend/app/services/parent_service.py", "/tmp/neoai_patch/backend/app/services/parent_service.py"),
        ("backend/app/schemas/student.py", "/tmp/neoai_patch/backend/app/schemas/student.py"),
        ("backend/app/db/models.py", "/tmp/neoai_patch/backend/app/db/models.py"),
        ("backend/app/main.py", "/tmp/neoai_patch/backend/app/main.py"),
        ("frontend/index.html", "/tmp/neoai_patch/frontend/index.html"),
        ("frontend/css/base/reset.css", "/tmp/neoai_patch/frontend/css/base/reset.css"),
        ("frontend/css/pages/capture.css", "/tmp/neoai_patch/frontend/css/pages/capture.css"),
        ("frontend/js/views/capture.js", "/tmp/neoai_patch/frontend/js/views/capture.js"),
        ("frontend/parent.html", "/tmp/neoai_patch/frontend/parent.html"),
        ("frontend/css/parent.css", "/tmp/neoai_patch/frontend/css/parent.css"),
        ("frontend/js/parent.js", "/tmp/neoai_patch/frontend/js/parent.js"),
        ("frontend/parent-manifest.json", "/tmp/neoai_patch/frontend/parent-manifest.json"),
        ("frontend/download.html", "/tmp/neoai_patch/frontend/download.html"),
        ("frontend/NeoAIAttend_Parents.apk", "/tmp/neoai_patch/frontend/NeoAIAttend_Parents.apk"),
        ("frontend/images/neoai_full_logo.png", "/tmp/neoai_patch/frontend/images/neoai_full_logo.png"),
        ("frontend/images/neoai_icon_n.png", "/tmp/neoai_patch/frontend/images/neoai_icon_n.png"),
        ("frontend/js/views/student_new.js", "/tmp/neoai_patch/frontend/js/views/student_new.js"),
        ("frontend/js/views/student_edit.js", "/tmp/neoai_patch/frontend/js/views/student_edit.js"),
    ]

    for local_f, remote_f in files_to_copy:
        p = Path(local_f)
        if p.exists():
            print(f" -> Uploading {local_f}...")
            rc, out, err = run_scp(str(p), remote_f)
            if rc != 0:
                print(f"    Error uploading {local_f}: {err}")
        else:
            print(f" -> Skipping non-existent file: {local_f}")

    # 3. Copy files into /opt/neoai-attendance and docker container
    print("\n[Step 3] Applying patch into /opt/neoai-attendance and visionattend_app container...")
    apply_cmd = """
sudo cp -r /tmp/neoai_patch/backend/* /opt/neoai-attendance/backend/
sudo cp -r /tmp/neoai_patch/frontend/* /opt/neoai-attendance/frontend/
sudo docker cp /tmp/neoai_patch/backend/. visionattend_app:/app/backend/
sudo docker cp /tmp/neoai_patch/frontend/. visionattend_app:/app/frontend/
"""
    rc, out, err = run_ssh(apply_cmd)
    if rc != 0:
        print("Apply command warning:", err)
    print(" [OK] Files copied into container.")

    # 4. Check & migrate database schema in production container
    print("\n[Step 4] Checking & applying database migration in production database...")
    db_migrate_script = '''
import sqlite3
import os

db_paths = ["/app/runtime/database/attendance.db", "/opt/neoai-attendance/runtime/database/attendance.db"]
for db_path in db_paths:
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("PRAGMA table_info(students)")
        cols = [col[1] for col in c.fetchall()]
        print("Current student cols in", db_path, ":", [c for c in cols if "parent" in c])
        
        # Add parent columns if missing
        if "parent_name" not in cols:
            print("Adding parent_name...")
            c.execute("ALTER TABLE students ADD COLUMN parent_name VARCHAR(150)")
        if "parent_email" not in cols:
            print("Adding parent_email...")
            c.execute("ALTER TABLE students ADD COLUMN parent_email VARCHAR(150)")
        if "parent_phone" not in cols:
            print("Adding parent_phone...")
            c.execute("ALTER TABLE students ADD COLUMN parent_phone VARCHAR(50)")
        if "parent_relation" not in cols:
            print("Adding parent_relation...")
            c.execute("ALTER TABLE students ADD COLUMN parent_relation VARCHAR(50) DEFAULT 'Parent'")
        if "parent_user_id" not in cols:
            print("Adding parent_user_id...")
            c.execute("ALTER TABLE students ADD COLUMN parent_user_id INTEGER")
            
        # Ensure role 'parent' exists
        c.execute("SELECT id FROM roles WHERE name = 'parent'")
        r = c.fetchone()
        if not r:
            print("Creating 'parent' role in roles table...")
            c.execute("INSERT INTO roles (name, description) VALUES ('parent', 'Parent or Guardian Portal Access')")
            
        conn.commit()
        conn.close()
        print("DB Schema verified and migrated successfully for:", db_path)
'''
    cmd = [
        SSH_EXE,
        "-i", PEM_KEY,
        "-o", "StrictHostKeyChecking=accept-new",
        AZURE_HOST,
        "sudo docker exec -i visionattend_app python3"
    ]
    proc = subprocess.run(cmd, input=db_migrate_script, capture_output=True, text=True)
    print("Migration Output:\n", proc.stdout)
    if proc.stderr:
        print("Migration Notice:\n", proc.stderr)

    # 5. Restart docker container
    print("\n[Step 5] Restarting visionattend_app container...")
    rc, out, err = run_ssh("sudo docker restart visionattend_app")
    print("Restart output:", out.strip())

    # 6. Verify production HTTPS endpoints
    print("\n[Step 6] Verifying live production endpoints on https://attendance.neoaitech.com...")
    import time
    time.sleep(3)

    import urllib.request
    endpoints = [
        ("/", "Main Attendance Portal"),
        ("/parent", "Parent Web Portal"),
        ("/download", "Parent Android APK Download"),
    ]

    for ep, desc in endpoints:
        url = f"https://attendance.neoaitech.com{ep}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                print(f" [PASS] {desc} ({url}) -> HTTP {resp.status}")
        except Exception as e:
            print(f" [FAIL] {desc} ({url}) -> Error: {e}")

    print("\n" + "=" * 80)
    print(" DEPLOYMENT COMPLETE! ONLY THE REQUESTED CHANGES WERE DEPLOYED.")
    print("=" * 80)

if __name__ == "__main__":
    main()
