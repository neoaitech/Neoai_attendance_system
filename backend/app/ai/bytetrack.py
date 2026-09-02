import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum


class TrackState(Enum):
    New = 0
    Tracked = 1
    Lost = 2
    Removed = 3


def compute_iou_matrix(atlbrs: np.ndarray, btlbrs: np.ndarray) -> np.ndarray:
    """
    Computes cost matrix based on IoU distance (1 - IoU).
    """
    if len(atlbrs) == 0 or len(btlbrs) == 0:
        return np.zeros((len(atlbrs), len(btlbrs)), dtype=np.float32)

    ious = np.zeros((len(atlbrs), len(btlbrs)), dtype=np.float32)
    for i, a in enumerate(atlbrs):
        ax1, ay1, ax2, ay2 = a
        area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
        for j, b in enumerate(btlbrs):
            bx1, by1, bx2, by2 = b
            area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)

            xx1 = max(ax1, bx1)
            yy1 = max(ay1, by1)
            xx2 = min(ax2, bx2)
            yy2 = min(ay2, by2)

            w = max(0.0, xx2 - xx1)
            h = max(0.0, yy2 - yy1)
            inter = w * h
            union = area_a + area_b - inter
            if union > 0:
                ious[i, j] = inter / union
            else:
                ious[i, j] = 0.0

    return 1.0 - ious


class STrack:
    _count = 0

    def __init__(self, tlbr: np.ndarray, score: float, feature: Optional[np.ndarray] = None):
        STrack._count += 1
        self.track_id = STrack._count
        self.tlbr = np.asarray(tlbr, dtype=np.float32)  # [x1, y1, x2, y2]
        self.score = float(score)
        self.state = TrackState.New
        self.is_activated = False
        self.frame_id = 0
        self.start_frame = 0
        self.time_since_update = 0

        # Trajectory History for Multi-Frame Voting
        self.history_bboxes: List[Tuple[int, int, int, int]] = []  # (top, right, bottom, left)
        self.history_embeddings: List[np.ndarray] = []
        self.history_confidences: List[float] = []
        self.history_liveness: List[float] = []
        self.history_recognitions: List[Dict[str, Any]] = []

        if feature is not None:
            self.history_embeddings.append(feature)

    @property
    def bbox_trbl(self) -> Tuple[int, int, int, int]:
        """Convert [x1, y1, x2, y2] to (top, right, bottom, left)."""
        x1, y1, x2, y2 = self.tlbr
        return int(round(y1)), int(round(x2)), int(round(y2)), int(round(x1))

    def activate(self, frame_id: int):
        self.frame_id = frame_id
        self.start_frame = frame_id
        self.state = TrackState.Tracked
        self.is_activated = True
        self.history_bboxes.append(self.bbox_trbl)
        self.history_confidences.append(self.score)

    def re_activate(self, new_track: 'STrack', frame_id: int):
        self.tlbr = new_track.tlbr
        self.score = new_track.score
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id
        self.time_since_update = 0
        self.history_bboxes.append(self.bbox_trbl)
        self.history_confidences.append(self.score)
        if len(new_track.history_embeddings) > 0:
            self.history_embeddings.extend(new_track.history_embeddings)

    def update(self, new_track: 'STrack', frame_id: int):
        self.frame_id = frame_id
        self.time_since_update = 0
        self.tlbr = new_track.tlbr
        self.score = new_track.score
        self.state = TrackState.Tracked
        self.is_activated = True
        self.history_bboxes.append(self.bbox_trbl)
        self.history_confidences.append(self.score)
        if len(new_track.history_embeddings) > 0:
            self.history_embeddings.extend(new_track.history_embeddings)

    def mark_lost(self):
        self.state = TrackState.Lost

    def mark_removed(self):
        self.state = TrackState.Removed


class ByteTracker:
    """
    ByteTrack: Multi-Object Tracking by Associating Every Detection Box.
    Maintains robust trajectory identity across multi-photo bursts and camera streams.
    """

    def __init__(
        self,
        track_thresh: float = 0.50,
        high_thresh: float = 0.60,
        match_thresh: float = 0.70,
        max_time_lost: int = 30
    ):
        self.track_thresh = track_thresh
        self.high_thresh = high_thresh
        self.match_thresh = match_thresh
        self.max_time_lost = max_time_lost

        self.frame_id = 0
        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.removed_stracks: List[STrack] = []

    def reset(self):
        STrack._count = 0
        self.frame_id = 0
        self.tracked_stracks.clear()
        self.lost_stracks.clear()
        self.removed_stracks.clear()

    def update(
        self,
        bboxes: np.ndarray,
        scores: np.ndarray,
        features: Optional[List[Optional[np.ndarray]]] = None
    ) -> List[STrack]:
        """
        Updates tracks with new frame detections.
        Args:
            bboxes: np.ndarray shape (N, 4) in [x1, y1, x2, y2]
            scores: np.ndarray shape (N,)
            features: Optional list of embeddings
        Returns:
            List of currently active and tracked STrack objects
        """
        self.frame_id += 1
        activated_stracks = []
        refind_stracks = []
        lost_stracks = []
        removed_stracks = []

        if len(bboxes) > 0:
            if features is None or len(features) != len(bboxes):
                features = [None] * len(bboxes)
            detections = [STrack(b, s, f) for b, s, f in zip(bboxes, scores, features)]
        else:
            detections = []

        # Split into high score and low score detections
        dets_high = [d for d in detections if d.score >= self.track_thresh]
        dets_low = [d for d in detections if self.track_thresh > d.score >= 0.10]

        # Pool of tracked candidates
        unconfirmed = [t for t in self.tracked_stracks if not t.is_activated]
        tracked_pool = [t for t in self.tracked_stracks if t.is_activated]
        strack_pool = tracked_pool + self.lost_stracks

        # Stage 1: Association with high-confidence detections
        dists = compute_iou_matrix(
            np.array([t.tlbr for t in strack_pool]),
            np.array([d.tlbr for d in dets_high])
        )

        matches_1, u_track_1, u_detection_1 = self._linear_assignment(dists, self.match_thresh)

        for itracked, idet in matches_1:
            track = strack_pool[itracked]
            det = dets_high[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_stracks.append(track)
            else:
                track.re_activate(det, self.frame_id)
                refind_stracks.append(track)

        # Stage 2: Association with low-confidence detections
        r_tracked_stracks = [strack_pool[i] for i in u_track_1 if strack_pool[i].state == TrackState.Tracked]
        dists_2 = compute_iou_matrix(
            np.array([t.tlbr for t in r_tracked_stracks]),
            np.array([d.tlbr for d in dets_low])
        )
        matches_2, u_track_2, u_detection_2 = self._linear_assignment(dists_2, 0.50)

        for itracked, idet in matches_2:
            track = r_tracked_stracks[itracked]
            det = dets_low[idet]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id)
                activated_stracks.append(track)
            else:
                track.re_activate(det, self.frame_id)
                refind_stracks.append(track)

        for it in u_track_2:
            track = r_tracked_stracks[it]
            if track.state != TrackState.Lost:
                track.mark_lost()
                lost_stracks.append(track)

        # Stage 3: Initiate new tracks for unassigned high-confidence detections
        for inew in u_detection_1:
            track = dets_high[inew]
            if track.score < self.high_thresh:
                continue
            track.activate(self.frame_id)
            activated_stracks.append(track)

        # Stage 4: Update lost and removed tracks
        for track in self.lost_stracks:
            if self.frame_id - track.frame_id > self.max_time_lost:
                track.mark_removed()
                removed_stracks.append(track)

        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.Tracked]
        self.tracked_stracks = list(dict.fromkeys(self.tracked_stracks + activated_stracks + refind_stracks))
        self.lost_stracks = [t for t in self.lost_stracks if t.state == TrackState.Lost]
        self.lost_stracks += lost_stracks
        self.lost_stracks = list(dict.fromkeys(self.lost_stracks))
        self.removed_stracks += removed_stracks

        # Return only active, currently tracked faces
        return [t for t in self.tracked_stracks if t.is_activated]

    @staticmethod
    def _linear_assignment(cost_matrix: np.ndarray, thresh: float) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """
        Greedy/Hungarian matching algorithm for cost matrix.
        """
        if cost_matrix.size == 0:
            return [], list(range(cost_matrix.shape[0])), list(range(cost_matrix.shape[1]))

        matches = []
        unmatched_a = list(range(cost_matrix.shape[0]))
        unmatched_b = list(range(cost_matrix.shape[1]))

        # Greedy match by minimum cost
        rows, cols = cost_matrix.shape
        cost_flat = []
        for r in range(rows):
            for c in range(cols):
                cost_flat.append((cost_matrix[r, c], r, c))

        cost_flat.sort(key=lambda x: x[0])
        matched_rows = set()
        matched_cols = set()

        for cost, r, c in cost_flat:
            if cost > thresh:
                break
            if r in matched_rows or c in matched_cols:
                continue
            matched_rows.add(r)
            matched_cols.add(c)
            matches.append((r, c))

        unmatched_a = [r for r in unmatched_a if r not in matched_rows]
        unmatched_b = [c for c in unmatched_b if c not in matched_cols]

        return matches, unmatched_a, unmatched_b
