import subprocess
import requests
import io
from PIL import Image

code = """
from backend.app.core.security import create_access_token
from backend.app.db.session import SessionLocal
from backend.app.db.models import User
db = SessionLocal()
u = db.query(User).filter(User.username == 'admin').first()
token = create_access_token(u.username, u.role)
print('LIVE_TOKEN:' + token)
"""

cmd = [
    r'C:\Windows\System32\OpenSSH\ssh.exe',
    '-i', r'C:\Users\Acer\Downloads\neoai-attendance-vm_key.pem',
    '-o', 'StrictHostKeyChecking=accept-new',
    'azureuser@40.80.87.73',
    'sudo docker exec -i visionattend_app python3'
]

proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=code)

token = None
for line in stdout.splitlines():
    if line.startswith("LIVE_TOKEN:"):
        token = line.split("LIVE_TOKEN:")[1].strip()
        break

if not token:
    print("Could not obtain token. Stdout:", stdout, "Stderr:", stderr)
    exit(1)

print("Obtained live admin token successfully!")
headers = {"Authorization": f"Bearer {token}"}

# 1. Test Staging Upload on live production site
buf = io.BytesIO()
Image.new("RGB", (120, 120), color=(60, 140, 220)).save(buf, format="JPEG")
files = {"file": ("test_live_instagram_trick.jpg", buf.getvalue(), "image/jpeg")}
data = {"purpose": "student"}

upload_res = requests.post(
    "https://attendance.neoaitech.com/api/staging/upload",
    files=files,
    data=data,
    headers=headers,
    timeout=15
)
print("1. Live Staging Upload Status:", upload_res.status_code)
print("   Response:", upload_res.json())
assert upload_res.status_code == 200
staging_id = upload_res.json().get("staging_id")
file_path = upload_res.json().get("file_path")
print(f"   Staging ID: {staging_id}, Disk Path on Azure: {file_path}")

# 2. Test Instant Retake / Delete on live production site
del_res = requests.delete(
    f"https://attendance.neoaitech.com/api/staging/{staging_id}",
    headers=headers,
    timeout=15
)
print("2. Live Instant Retake/Delete Status:", del_res.status_code)
print("   Response:", del_res.json())
assert del_res.status_code == 200
assert del_res.json().get("success") is True

# 3. Verify server file is completely gone from Azure VM disk
check_code = f"""
import os
exists = os.path.exists('{file_path}')
print('FILE_EXISTS_ON_DISK:' + str(exists))
"""
proc2 = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout2, stderr2 = proc2.communicate(input=check_code)
print("3. Disk Verification on Azure VM:", stdout2.strip())
assert "FILE_EXISTS_ON_DISK:False" in stdout2

print("\n>>> ALL CHECKS PASSED: Photo pre-upload staging and instant retake/delete are 100% LIVE and verified on https://attendance.neoaitech.com! <<<")
