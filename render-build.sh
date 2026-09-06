#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Installing Python production packages..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Verifying AI models..."
python -c "
import os, urllib.request
os.makedirs('models/arcface', exist_ok=True)
arc_path = 'models/arcface/arcface_w600k_r50.onnx'
if not os.path.exists(arc_path) or os.path.getsize(arc_path) < 1000000:
    print('Downloading ArcFace ONNX model (~166 MB)...')
    urllib.request.urlretrieve('https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx', arc_path)
    print('ArcFace ONNX model downloaded successfully!')
else:
    print('ArcFace model exists, size:', os.path.getsize(arc_path))
"

echo "==> Build successful!"
