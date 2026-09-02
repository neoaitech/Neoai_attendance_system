import os
import cv2
import logging
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional, Union
import onnxruntime as ort

logger = logging.getLogger("SCRFD")


class SCRFDDetector:
    """
    SCRFD (Sample and Computation Redistribution for Face Detection)
    Official DeepInsight ONNX detector with Multi-Scale FPN anchor decoding.
    """

    def __init__(
        self,
        model_path: Union[str, Path],
        conf_thresh: float = 0.25,
        nms_thresh: float = 0.40,
        providers: Optional[List[str]] = None
    ):
        self.model_path = str(model_path)
        self.conf_thresh = conf_thresh
        self.nms_thresh = nms_thresh
        self.providers = providers or ["CPUExecutionProvider"]

        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"SCRFD model file not found at: {self.model_path}")

        self.session = ort.InferenceSession(self.model_path, providers=self.providers)
        self.input_name = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape
        self._feat_stride_fpn = [8, 16, 32]
        self._num_anchors = 2

        logger.info(f"[SCRFD] Model loaded from {self.model_path} with providers: {self.session.get_providers()}")

    def detect(self, img_bgr: np.ndarray, max_size: int = 640) -> Tuple[np.ndarray, np.ndarray]:
        """
        Detects faces in BGR image.
        Returns:
            bboxes: np.ndarray of shape (N, 4) in [x1, y1, x2, y2] format
            scores: np.ndarray of shape (N,)
        """
        h, w = img_bgr.shape[:2]
        if h == 0 or w == 0:
            return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

        scale = max_size / max(h, w)
        nh, nw = int(h * scale), int(w * scale)
        pad_h = (32 - nh % 32) % 32
        pad_w = (32 - nw % 32) % 32

        resized = cv2.resize(img_bgr, (nw, nh))
        det_img = cv2.copyMakeBorder(resized, 0, pad_h, 0, pad_w, cv2.BORDER_CONSTANT, value=(0, 0, 0))

        blob = cv2.dnn.blobFromImage(
            det_img,
            scalefactor=1.0 / 128.0,
            size=(det_img.shape[1], det_img.shape[0]),
            mean=(127.5, 127.5, 127.5),
            swapRB=True
        )

        net_outs = self.session.run(None, {self.input_name: blob})

        scores_list = net_outs[:3]
        bboxes_list = net_outs[3:6]

        bboxes_all = []
        scores_all = []

        for idx, stride in enumerate(self._feat_stride_fpn):
            scores = scores_list[idx]
            bbox_preds = bboxes_list[idx] * stride

            f_h = det_img.shape[0] // stride
            f_w = det_img.shape[1] // stride

            anchor_centers = np.stack(np.mgrid[:f_h, :f_w][::-1], axis=-1).astype(np.float32)
            anchor_centers = (anchor_centers * stride).reshape((-1, 2))
            if self._num_anchors > 1:
                anchor_centers = np.stack([anchor_centers] * self._num_anchors, axis=1).reshape((-1, 2))

            pos_inds = np.where(scores >= self.conf_thresh)[0]
            if len(pos_inds) == 0:
                continue

            pos_scores = scores[pos_inds]
            pos_bboxes = bbox_preds[pos_inds]
            pos_centers = anchor_centers[pos_inds]

            x1 = pos_centers[:, 0] - pos_bboxes[:, 0]
            y1 = pos_centers[:, 1] - pos_bboxes[:, 1]
            x2 = pos_centers[:, 0] + pos_bboxes[:, 2]
            y2 = pos_centers[:, 1] + pos_bboxes[:, 3]

            boxes = np.stack([x1, y1, x2, y2], axis=-1) / scale
            bboxes_all.append(boxes)
            scores_all.append(pos_scores)

        if not bboxes_all:
            return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

        bboxes_all = np.vstack(bboxes_all)
        scores_all = np.vstack(scores_all).flatten()

        # Non-Maximum Suppression (NMS)
        indices = cv2.dnn.NMSBoxes(
            bboxes_all.tolist(),
            scores_all.tolist(),
            self.conf_thresh,
            self.nms_thresh
        )

        if len(indices) > 0:
            indices = np.array(indices).flatten()
            return bboxes_all[indices], scores_all[indices]

        return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)
