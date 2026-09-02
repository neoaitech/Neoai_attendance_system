# ArcFace ResNet-50 Model Directory

This directory holds arcface_w600k_r50.onnx (512-dimensional angular embedding model).

To download the pre-trained ArcFace ONNX model:
python scripts/download_models.py

Note: If this file is not present, VisionAttend automatically operates using the built-in Standard Face Recognition Engine (128-D Euclidean embeddings).
