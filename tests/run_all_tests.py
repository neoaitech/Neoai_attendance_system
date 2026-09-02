import sys
import subprocess
from pathlib import Path

def run_tests():
    print("=" * 70)
    print("  VisionAttend Pro - Comprehensive Test Suite Runner")
    print("=" * 70)
    
    project_root = Path(__file__).resolve().parent.parent
    cmd = [sys.executable, "-m", "pytest", "tests/", "-v", "--color=yes"]
    
    result = subprocess.run(cmd, cwd=str(project_root))
    if result.returncode == 0:
        print("\n" + "=" * 70)
        print("  [SUCCESS] All Unit, Integration, Biometric & DB Tests Passed 100%!")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("  [FAILURE] Some tests failed. Inspect the trace above.")
        print("=" * 70)
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(run_tests())
