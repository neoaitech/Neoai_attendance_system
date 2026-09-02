# MiniFASNetV2 Face Anti-Spoofing & Presentation Attack Detection

This directory stores the neural network model weights for **MiniFASNetV2** (Silent-Face-Anti-Spoofing).

## Model Specifications
- **Model Name**: `MiniFASNetV2`
- **Architecture**: Lightweight Deep Convolutional Neural Network with Inverted Residuals & Depthwise Separable Convolutions
- **Weights File**: `minifasnetv2.pth`
- **Input Dimensions**: `(1, 3, 80, 80)` normalized RGB tensor
- **Output Classes**:
  - Class 0: `P(Live)` - Real human face
  - Class 1: `P(Spoof_Screen)` - Digital monitor, tablet, or smartphone replay attack
  - Class 2: `P(Spoof_Paper)` - Printed photo or poster attack
- **Decision Workflow**:
  - If `is_live == True`: Face is forwarded to ArcFace ResNet-50 for 512-D embedding extraction and recognition.
  - If `is_live == False`: Recognition is immediately rejected, ArcFace is bypassed, and no attendance is granted.
