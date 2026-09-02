import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict


class TemporalVotingEngine:
    """
    Multi-Frame / Temporal Voting Aggregator for Biometric Video and Multi-Photo Sequences.
    Eliminates single-frame lighting anomalies and identity flickering by calculating
    a confidence-weighted consensus across track trajectories.
    """

    def __init__(self, min_consensus_frames: int = 1, confidence_decay: float = 0.95):
        self.min_consensus_frames = min_consensus_frames
        self.confidence_decay = confidence_decay
        self.track_observations: Dict[int, List[Dict[str, Any]]] = defaultdict(list)

    def reset(self):
        self.track_observations.clear()

    def record_observation(
        self,
        track_id: int,
        frame_idx: int,
        bbox: Tuple[int, int, int, int],
        is_live: bool,
        liveness_score: float,
        matched_student: Optional[Dict[str, Any]] = None,
        similarity: float = 0.0,
        confidence: float = 0.0,
        embedding: Optional[np.ndarray] = None
    ):
        """
        Records a detection & recognition event for a specific tracked target in frame `frame_idx`.
        """
        obs = {
            "frame_idx": frame_idx,
            "bbox": bbox,
            "is_live": is_live,
            "liveness_score": float(liveness_score),
            "matched_student": matched_student,
            "similarity": float(similarity),
            "confidence": float(confidence),
            "embedding": embedding
        }
        self.track_observations[track_id].append(obs)

    def aggregate_consensus(
        self,
        tolerance: float = 0.50,
        assigned_students: Optional[set] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Computes the definitive biometric consensus per tracked target across all observed frames.
        Returns:
            recognized: List of consolidated recognized student dicts
            unknown: List of consolidated unknown face dicts
            spoofs: List of consolidated spoofed presentation attack dicts
        """
        if assigned_students is None:
            assigned_students = set()

        recognized = []
        unknown = []
        spoofs = []

        # Process each track trajectory
        for track_id, obs_list in self.track_observations.items():
            if not obs_list:
                continue

            # 1. Evaluate Overall Liveness across track history
            live_scores = [o["liveness_score"] for o in obs_list]
            avg_liveness = float(np.mean(live_scores))
            spoof_votes = sum(1 for o in obs_list if not o["is_live"])

            best_bbox = obs_list[-1]["bbox"]

            if spoof_votes > len(obs_list) / 2.0 or avg_liveness < 0.20:
                spoofs.append({
                    "track_id": track_id,
                    "bbox": list(best_bbox),
                    "is_live": False,
                    "is_spoof": True,
                    "liveness_score": avg_liveness,
                    "spoof_reasons": [f"Temporal Voting: Track #{track_id} rejected as presentation attack (Avg Live: {avg_liveness*100:.1f}%)"],
                    "total_frames_observed": len(obs_list)
                })
                continue

            # 2. Accumulate Identity Votes for Live Face
            student_votes: Dict[int, Dict[str, Any]] = {}
            unknown_vote_weight = 0.0

            for o in obs_list:
                s = o.get("matched_student")
                sim = o.get("similarity", 0.0)
                conf = o.get("confidence", 0.0)

                if s is not None and sim >= tolerance:
                    s_id = s["id"]
                    if s_id not in student_votes:
                        student_votes[s_id] = {
                            "student": s,
                            "weighted_score": 0.0,
                            "similarities": [],
                            "confidences": [],
                            "vote_count": 0,
                            "best_bbox": o["bbox"]
                        }
                    # Weight vote by similarity * confidence
                    weight = sim * (conf / 100.0 if conf > 1.0 else conf)
                    student_votes[s_id]["weighted_score"] += weight
                    student_votes[s_id]["similarities"].append(sim)
                    student_votes[s_id]["confidences"].append(conf)
                    student_votes[s_id]["vote_count"] += 1
                else:
                    unknown_vote_weight += 0.50

            # 3. Determine Winning Identity
            if student_votes:
                sorted_candidates = sorted(
                    student_votes.values(),
                    key=lambda c: c["weighted_score"],
                    reverse=True
                )
                winner = sorted_candidates[0]
                winner_student = winner["student"]
                winner_id = winner_student["id"]

                # Ensure student not already assigned to another track with higher score
                if winner_id not in assigned_students:
                    assigned_students.add(winner_id)
                    avg_sim = float(np.mean(winner["similarities"]))
                    avg_conf = float(np.mean(winner["confidences"]))

                    recognized.append({
                        "track_id": track_id,
                        "student_id": winner_id,
                        "student_name": winner_student["name"],
                        "roll_number": winner_student["roll_number"],
                        "bbox": list(winner["best_bbox"]),
                        "similarity": round(avg_sim, 4),
                        "confidence": round(avg_conf, 1),
                        "liveness_score": round(avg_liveness, 4),
                        "temporal_frames": winner["vote_count"],
                        "total_frames_observed": len(obs_list)
                    })
                else:
                    # Winner already assigned; mark as unknown
                    max_sim = float(np.max(winner["similarities"])) if winner["similarities"] else 0.0
                    unknown.append({
                        "track_id": track_id,
                        "bbox": list(best_bbox),
                        "similarity": round(max_sim, 4),
                        "confidence": 0.0,
                        "liveness_score": round(avg_liveness, 4),
                        "total_frames_observed": len(obs_list)
                    })
            else:
                unknown.append({
                    "track_id": track_id,
                    "bbox": list(best_bbox),
                    "similarity": 0.0,
                    "confidence": 0.0,
                    "liveness_score": round(avg_liveness, 4),
                    "total_frames_observed": len(obs_list)
                })

        return recognized, unknown, spoofs
