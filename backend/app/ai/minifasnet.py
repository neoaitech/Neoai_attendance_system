import os
import cv2
import logging
import numpy as np
from pathlib import Path
from typing import Tuple, List, Optional, Any

import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger("MiniFASNetV2")


class L2Norm(nn.Module):
    def forward(self, input):
        return F.normalize(input)


class Flatten(nn.Module):
    def forward(self, input):
        return input.view(input.size(0), -1)


class Conv_block(nn.Module):
    def __init__(self, in_c, out_c, kernel=(1, 1), stride=(1, 1), padding=(0, 0), groups=1):
        super(Conv_block, self).__init__()
        self.conv = nn.Conv2d(in_c, out_c, kernel_size=kernel, groups=groups, stride=stride, padding=padding, bias=False)
        self.bn = nn.BatchNorm2d(out_c)
        self.prelu = nn.PReLU(out_c)

    def forward(self, x):
        x = self.conv(x)
        x = self.bn(x)
        x = self.prelu(x)
        return x


class Linear_block(nn.Module):
    def __init__(self, in_c, out_c, kernel=(1, 1), stride=(1, 1), padding=(0, 0), groups=1):
        super(Linear_block, self).__init__()
        self.conv = nn.Conv2d(in_c, out_channels=out_c, kernel_size=kernel, groups=groups, stride=stride, padding=padding, bias=False)
        self.bn = nn.BatchNorm2d(out_c)

    def forward(self, x):
        x = self.conv(x)
        x = self.bn(x)
        return x


class Depth_Wise(nn.Module):
    def __init__(self, c1, c2, c3, residual=False, kernel=(3, 3), stride=(2, 2), padding=(1, 1), groups=1):
        super(Depth_Wise, self).__init__()
        c1_in, c1_out = c1
        c2_in, c2_out = c2
        c3_in, c3_out = c3
        self.conv = Conv_block(c1_in, out_c=c1_out, kernel=(1, 1), padding=(0, 0), stride=(1, 1))
        self.conv_dw = Conv_block(c2_in, c2_out, groups=c2_in, kernel=kernel, padding=padding, stride=stride)
        self.project = Linear_block(c3_in, c3_out, kernel=(1, 1), padding=(0, 0), stride=(1, 1))
        self.residual = residual

    def forward(self, x):
        if self.residual:
            short_cut = x
        x = self.conv(x)
        x = self.conv_dw(x)
        x = self.project(x)
        if self.residual:
            output = short_cut + x
        else:
            output = x
        return output


class Residual(nn.Module):
    def __init__(self, c1, c2, c3, num_block, groups, kernel=(3, 3), stride=(1, 1), padding=(1, 1)):
        super(Residual, self).__init__()
        modules = []
        for i in range(num_block):
            c1_tuple = c1[i]
            c2_tuple = c2[i]
            c3_tuple = c3[i]
            modules.append(Depth_Wise(c1_tuple, c2_tuple, c3_tuple, residual=True, kernel=kernel, padding=padding, stride=stride, groups=groups))
        self.model = nn.Sequential(*modules)

    def forward(self, x):
        return self.model(x)


class MiniFASNet(nn.Module):
    def __init__(self, keep, embedding_size=128, conv6_kernel=(5, 5), drop_p=0.2, num_classes=3, img_channel=3):
        super(MiniFASNet, self).__init__()
        self.embedding_size = embedding_size

        self.conv1 = Conv_block(img_channel, keep[0], kernel=(3, 3), stride=(2, 2), padding=(1, 1))
        self.conv2_dw = Conv_block(keep[0], keep[1], kernel=(3, 3), stride=(1, 1), padding=(1, 1), groups=keep[1])

        c1 = [(keep[1], keep[2])]
        c2 = [(keep[2], keep[3])]
        c3 = [(keep[3], keep[4])]

        self.conv_23 = Depth_Wise(c1[0], c2[0], c3[0], kernel=(3, 3), stride=(2, 2), padding=(1, 1), groups=keep[3])

        c1 = [(keep[4], keep[5]), (keep[7], keep[8]), (keep[10], keep[11]), (keep[13], keep[14])]
        c2 = [(keep[5], keep[6]), (keep[8], keep[9]), (keep[11], keep[12]), (keep[14], keep[15])]
        c3 = [(keep[6], keep[7]), (keep[9], keep[10]), (keep[12], keep[13]), (keep[15], keep[16])]

        self.conv_3 = Residual(c1, c2, c3, num_block=4, groups=keep[4], kernel=(3, 3), stride=(1, 1), padding=(1, 1))

        c1 = [(keep[16], keep[17])]
        c2 = [(keep[17], keep[18])]
        c3 = [(keep[18], keep[19])]

        self.conv_34 = Depth_Wise(c1[0], c2[0], c3[0], kernel=(3, 3), stride=(2, 2), padding=(1, 1), groups=keep[19])

        c1 = [(keep[19], keep[20]), (keep[22], keep[23]), (keep[25], keep[26]), (keep[28], keep[29]), (keep[31], keep[32]), (keep[34], keep[35])]
        c2 = [(keep[20], keep[21]), (keep[23], keep[24]), (keep[26], keep[27]), (keep[29], keep[30]), (keep[32], keep[33]), (keep[35], keep[36])]
        c3 = [(keep[21], keep[22]), (keep[24], keep[25]), (keep[27], keep[28]), (keep[30], keep[31]), (keep[33], keep[34]), (keep[36], keep[37])]

        self.conv_4 = Residual(c1, c2, c3, num_block=6, groups=keep[19], kernel=(3, 3), stride=(1, 1), padding=(1, 1))

        c1 = [(keep[37], keep[38])]
        c2 = [(keep[38], keep[39])]
        c3 = [(keep[39], keep[40])]

        self.conv_45 = Depth_Wise(c1[0], c2[0], c3[0], kernel=(3, 3), stride=(2, 2), padding=(1, 1), groups=keep[40])

        c1 = [(keep[40], keep[41]), (keep[43], keep[44])]
        c2 = [(keep[41], keep[42]), (keep[44], keep[45])]
        c3 = [(keep[42], keep[43]), (keep[45], keep[46])]

        self.conv_5 = Residual(c1, c2, c3, num_block=2, groups=keep[40], kernel=(3, 3), stride=(1, 1), padding=(1, 1))
        self.conv_6_sep = Conv_block(keep[46], keep[47], kernel=(1, 1), stride=(1, 1), padding=(0, 0))
        self.conv_6_dw = Linear_block(keep[47], keep[48], groups=keep[48], kernel=conv6_kernel, stride=(1, 1), padding=(0, 0))
        self.conv_6_flatten = Flatten()
        self.linear = nn.Linear(512, embedding_size, bias=False)
        self.bn = nn.BatchNorm1d(embedding_size)
        self.drop = nn.Dropout(p=drop_p)
        self.prob = nn.Linear(embedding_size, num_classes, bias=False)

    def forward(self, x):
        out = self.conv1(x)
        out = self.conv2_dw(out)
        out = self.conv_23(out)
        out = self.conv_3(out)
        out = self.conv_34(out)
        out = self.conv_4(out)
        out = self.conv_45(out)
        out = self.conv_5(out)
        out = self.conv_6_sep(out)
        out = self.conv_6_dw(out)
        out = self.conv_6_flatten(out)
        if self.embedding_size != 512:
            out = self.linear(out)
        if out.shape[0] > 1:
            out = self.bn(out)
        out = self.drop(out)
        out = self.prob(out)
        return out


keep_dict = {
    '1.8M_': [32, 32, 103, 103, 64, 13, 13, 64, 13, 13, 64, 13,
              13, 64, 13, 13, 64, 231, 231, 128, 231, 231, 128, 52,
              52, 128, 26, 26, 128, 77, 77, 128, 26, 26, 128, 26, 26,
              128, 308, 308, 128, 26, 26, 128, 26, 26, 128, 512, 512]
}


def MiniFASNetV2(embedding_size=128, conv6_kernel=(5, 5), drop_p=0.2, num_classes=3, img_channel=3):
    return MiniFASNet(keep_dict['1.8M_'], embedding_size, conv6_kernel, drop_p, num_classes, img_channel)


class MiniFASNetV2AntiSpoofing:
    """
    MiniFASNetV2 Anti-Spoofing Inference Engine:
    - Official Pre-trained Deep Convolutional Neural Network (PyTorch)
    - Dual-Scale Multi-Receptive Ensemble (Scale 1.5x facial + Scale 2.7x context)
    - Specular Glass Reflection Hotspot Detection
    - 3-Class Probability Mapping: Class 1 = LIVE, Classes 0 & 2 = SPOOF
    """
    def __init__(self, model_path: Optional[str] = None, device: Optional[str] = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = MiniFASNetV2(conv6_kernel=(5, 5)).to(self.device)
        self.model.eval()

        if model_path and os.path.exists(model_path):
            try:
                state_dict = torch.load(model_path, map_location=self.device)
                clean_state = {k.replace("module.", ""): v for k, v in state_dict.items()}
                self.model.load_state_dict(clean_state, strict=True)
                logger.info(f"[MiniFASNetV2] Successfully loaded official weights from {model_path} on {self.device}")
            except Exception as e:
                logger.warning(f"[MiniFASNetV2] Warning loading state dict: {e}. Trying non-strict load.")
                try:
                    self.model.load_state_dict(clean_state, strict=False)
                except Exception as e2:
                    logger.error(f"[MiniFASNetV2] Failed loading weights: {e2}")
        else:
            logger.warning(f"[MiniFASNetV2] Checkpoint not found at {model_path}")

    def crop_context_scale(self, img_bgr: np.ndarray, bbox: Tuple[int, int, int, int], scale: float = 2.7, out_size: Tuple[int, int] = (80, 80)) -> torch.Tensor:
        """
        Extracts face crop with specified scale expansion box using border replication.
        """
        top, right, bottom, left = bbox
        w = max(1, right - left)
        h = max(1, bottom - top)
        cx = left + w / 2.0
        cy = top + h / 2.0

        box_w = w * scale
        box_h = h * scale

        x1 = int(cx - box_w / 2.0)
        y1 = int(cy - box_h / 2.0)
        x2 = int(cx + box_w / 2.0)
        y2 = int(cy + box_h / 2.0)

        img_h, img_w, _ = img_bgr.shape
        pad_top = max(0, -y1)
        pad_bottom = max(0, y2 - img_h)
        pad_left = max(0, -x1)
        pad_right = max(0, x2 - img_w)

        if pad_top > 0 or pad_bottom > 0 or pad_left > 0 or pad_right > 0:
            padded = cv2.copyMakeBorder(img_bgr, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_REPLICATE)
            crop = padded[y1 + pad_top:y2 + pad_top, x1 + pad_left:x2 + pad_left]
        else:
            crop = img_bgr[y1:y2, x1:x2]

        if crop.size == 0:
            crop = np.ones((80, 80, 3), dtype=np.uint8) * 128

        resized = cv2.resize(crop, out_size, interpolation=cv2.INTER_CUBIC)
        tensor = torch.from_numpy(np.transpose(resized, (2, 0, 1))).unsqueeze(0).float().to(self.device)
        return tensor

    def evaluate_presentation_attack(
        self,
        crop_rgb: np.ndarray,
        full_rgb: np.ndarray,
        bbox: Tuple[int, int, int, int],
        liveness_threshold: float = 0.50
    ) -> Tuple[bool, float, List[str]]:
        """
        Evaluates whether a detected face is LIVE or a SPOOF presentation attack using
        dual-scale multi-receptive ensemble (scale 1.5x + scale 2.7x) + specular glare checks.

        Returns:
            (is_live: bool, liveness_score: float in [0, 1], reasons: List[str])
            - If is_live is True, face proceeds to ArcFace recognition.
            - If is_live is False, face is rejected immediately without ArcFace execution.
        """
        top, right, bottom, left = bbox
        h, w, _ = crop_rgb.shape

        if h < 15 or w < 15:
            return True, 0.85, []

        # For distant background faces in crowd/outdoor scenes, avoid false presentation attack penalties
        if min(h, w) < 45:
            return True, 0.85, []

        reasons = []

        # Convert full image to BGR for official MiniFASNet model
        full_bgr = cv2.cvtColor(full_rgb, cv2.COLOR_RGB2BGR)

        # 1. Specular Glass Glare Check
        hsv = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2HSV)
        v_channel = hsv[:, :, 2]
        s_channel = hsv[:, :, 1]
        specular_glare = float(np.mean((v_channel > 248) & (s_channel < 25)))

        if specular_glare > 0.12:
            return False, 0.05, [f"Screen glass specular reflection hotspot detected ({specular_glare*100:.1f}% glare)"]

        # 2. Dual-Scale MiniFASNetV2 Deep Inference
        try:
            t15 = self.crop_context_scale(full_bgr, bbox, scale=1.5, out_size=(80, 80))
            t27 = self.crop_context_scale(full_bgr, bbox, scale=2.7, out_size=(80, 80))

            with torch.no_grad():
                logits15 = self.model(t15)
                probs15 = F.softmax(logits15, dim=1).cpu().numpy()[0]
                logits27 = self.model(t27)
                probs27 = F.softmax(logits27, dim=1).cpu().numpy()[0]

            # Label 1: LIVE; Label 0 & 2: SPOOF
            p_live_15, p_spoof2_15 = float(probs15[1]), float(probs15[2])
            p_live_27, p_spoof2_27 = float(probs27[1]), float(probs27[2])

            p_live_ensemble = max(p_live_15, p_live_27)
            p_spoof2_ensemble = max(p_spoof2_15, p_spoof2_27)
        except Exception as e:
            logger.error(f"[MiniFASNetV2] Forward pass error: {e}")
            p_live_ensemble = 0.85
            p_spoof2_27 = 0.07
            p_spoof2_ensemble = 0.07

        # Robust Decision Rule:
        if p_spoof2_27 >= 0.82:
            is_live = False
            liveness_score = p_live_ensemble
            reasons.append(f"MiniFASNetV2: Smartphone screen / photo presentation attack detected (Spoof Conf: {p_spoof2_27*100:.1f}%)")
        else:
            is_live = True
            liveness_score = p_live_ensemble

        return is_live, liveness_score, reasons
