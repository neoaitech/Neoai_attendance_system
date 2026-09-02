import os
import urllib.request
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "arcface"
MODEL_PATH = MODEL_DIR / "arcface_w600k_r50.onnx"
DOWNLOAD_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/w600k_r50.onnx"

def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists():
        print(f"ArcFace ONNX model already exists at: {MODEL_PATH}")
        return
    print(f"Downloading ArcFace ONNX model (~166 MB) to: {MODEL_PATH} ...")
    try:
        urllib.request.urlretrieve(DOWNLOAD_URL, MODEL_PATH)
        print("Download completed successfully!")
    except Exception as e:
        print(f"Failed to auto-download: {e}")
        print("You can manually place arcface_w600k_r50.onnx into models/arcface/")

if __name__ == "__main__":
    main()
