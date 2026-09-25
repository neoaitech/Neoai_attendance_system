import subprocess

def run_ssh(remote_cmd):
    cmd = [
        r'C:\Windows\System32\OpenSSH\ssh.exe',
        '-i', r'C:\Users\Acer\Downloads\neoai-attendance-vm_key.pem',
        '-o', 'StrictHostKeyChecking=accept-new',
        'azureuser@40.80.87.73',
        remote_cmd
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.stdout, proc.stderr

print("1. Fixing permissions and pulling latest code on Azure VM...")
out, err = run_ssh('sudo chown -R azureuser:azureuser /opt/neoai-attendance && cd /opt/neoai-attendance && git pull origin main')
print("PULL OUT:", out)
if err: print("PULL ERR:", err)

print("2. Copying files into docker container visionattend_app...")
out, err = run_ssh('sudo docker cp /opt/neoai-attendance/backend visionattend_app:/app/ && sudo docker cp /opt/neoai-attendance/frontend visionattend_app:/app/')
print("CP OUT:", out)
if err: print("CP ERR:", err)

print("3. Re-seeding roles and permissions in Azure VM database...")
seed_code = """
from backend.app.db.session import SessionLocal
from backend.app.services.permission_service import permission_service
from backend.app.db.models import Role
db = SessionLocal()
permission_service.seed_default_roles_and_permissions(db)
sa = db.query(Role).filter(Role.name == 'super_admin').first()
fa = db.query(Role).filter(Role.name == 'faculty').first()
print('Super Admin perms:', len(sa.permissions))
print('Faculty perms:', len(fa.permissions))
print('student.export in faculty:', any(p.key == 'student.export' for p in fa.permissions))
print('attendance.edit in faculty:', any(p.key == 'attendance.edit' for p in fa.permissions))
"""
cmd = [
    r'C:\Windows\System32\OpenSSH\ssh.exe',
    '-i', r'C:\Users\Acer\Downloads\neoai-attendance-vm_key.pem',
    '-o', 'StrictHostKeyChecking=accept-new',
    'azureuser@40.80.87.73',
    'sudo docker exec -i visionattend_app python3'
]
proc = subprocess.run(cmd, input=seed_code, capture_output=True, text=True)
print("SEED OUTPUT:\n", proc.stdout)
if proc.stderr: print("SEED ERR:\n", proc.stderr)

print("4. Restarting visionattend_app container...")
out, err = run_ssh('sudo docker restart visionattend_app')
print("RESTART:", out)
if err: print("RESTART ERR:", err)
print("DONE!")
