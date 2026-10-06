import math
from typing import List, Dict, Any, Tuple, Optional
import difflib


def calculate_box_iou(boxA: List[int], boxB: List[int]) -> float:
    """
    Calculate Intersection over Union (IoU) of two bounding boxes.
    Boxes are in format [x_min, y_min, x_max, y_max].
    """
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_width = max(0, xB - xA)
    inter_height = max(0, yB - yA)
    inter_area = inter_width * inter_height

    boxA_area = max(0, boxA[2] - boxA[0]) * max(0, boxA[3] - boxA[1])
    boxB_area = max(0, boxB[2] - boxB[0]) * max(0, boxB[3] - boxB[1])
    union_area = boxA_area + boxB_area - inter_area

    if union_area <= 0:
        return 0.0

    return round(inter_area / union_area, 4)


def evaluate_bounding_boxes(
    gt_boxes: List[Dict[str, Any]],
    pred_boxes: List[Dict[str, Any]],
    iou_threshold: float = 0.5,
    loc_error_threshold: float = 0.2,
) -> Dict[str, Any]:
    """
    Evaluate predicted word bounding boxes against ground-truth bounding boxes.
    
    gt_boxes: list of dicts with 'bbox' ([x1, y1, x2, y2]) and 'text' / 'transcription'
    pred_boxes: list of dicts with 'bbox' ([x1, y1, x2, y2]) and 'text' and 'confidence'
    
    Returns:
    - precision, recall, f1
    - mean_word_iou
    - classification per prediction: 'correct', 'false_positive', 'incorrect_localization'
    - classification per ground truth: 'detected', 'false_negative'
    """
    if not gt_boxes:
        return {
            "precision": 0.0 if pred_boxes else 1.0,
            "recall": 0.0,
            "f1": 0.0,
            "mean_word_iou": 0.0,
            "true_positives": 0,
            "false_positives": len(pred_boxes),
            "false_negatives": 0,
            "total_gt": 0,
            "total_pred": len(pred_boxes),
            "pred_eval": [{"bbox": b.get("bbox", []), "text": b.get("text", ""), "status": "false_positive", "iou": 0.0} for b in pred_boxes],
            "gt_eval": [],
        }

    if not pred_boxes:
        return {
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "mean_word_iou": 0.0,
            "true_positives": 0,
            "false_positives": 0,
            "false_negatives": len(gt_boxes),
            "total_gt": len(gt_boxes),
            "total_pred": 0,
            "pred_eval": [],
            "gt_eval": [{"bbox": b.get("bbox", []), "text": b.get("transcription", b.get("text", "")), "status": "false_negative"} for b in gt_boxes],
        }

    # Normalize box format
    norm_gt = []
    for i, g in enumerate(gt_boxes):
        box = g.get("bbox") or [g.get("x_min", 0), g.get("y_min", 0), g.get("x_max", 0), g.get("y_max", 0)]
        text = g.get("transcription") or g.get("text", "")
        norm_gt.append({"id": g.get("word_id", f"gt_{i}"), "bbox": box, "text": text})

    norm_pred = []
    for j, p in enumerate(pred_boxes):
        box = p.get("bbox") or [p.get("x_min", 0), p.get("y_min", 0), p.get("x_max", 0), p.get("y_max", 0)]
        text = p.get("text", "")
        conf = p.get("confidence", 1.0)
        norm_pred.append({"id": f"pred_{j}", "bbox": box, "text": text, "confidence": conf})

    # Compute all pairwise IoUs
    iou_matrix = []
    for g_idx, g in enumerate(norm_gt):
        row = []
        for p_idx, p in enumerate(norm_pred):
            iou = calculate_box_iou(g["bbox"], p["bbox"])
            row.append(iou)
        iou_matrix.append(row)

    # Greedy bipartite matching on highest IoU
    matches = []
    all_pairs = []
    for g_idx in range(len(norm_gt)):
        for p_idx in range(len(norm_pred)):
            all_pairs.append((iou_matrix[g_idx][p_idx], g_idx, p_idx))

    all_pairs.sort(key=lambda x: x[0], reverse=True)

    matched_gt = set()
    matched_pred = set()
    pair_ious = []

    pred_eval_map = {}
    gt_eval_map = {g_idx: "false_negative" for g_idx in range(len(norm_gt))}

    for iou, g_idx, p_idx in all_pairs:
        if iou < loc_error_threshold:
            break
        if g_idx in matched_gt or p_idx in matched_pred:
            continue

        matched_gt.add(g_idx)
        matched_pred.add(p_idx)
        pair_ious.append(iou)

        if iou >= iou_threshold:
            status = "correct"
            gt_eval_map[g_idx] = "detected"
        else:
            status = "incorrect_localization"
            gt_eval_map[g_idx] = "incorrect_localization"

        pred_eval_map[p_idx] = {
            "bbox": norm_pred[p_idx]["bbox"],
            "text": norm_pred[p_idx]["text"],
            "confidence": norm_pred[p_idx]["confidence"],
            "status": status,
            "iou": round(iou, 4),
            "matched_gt_id": norm_gt[g_idx]["id"],
        }

    # Remaining predictions are False Positives
    for p_idx in range(len(norm_pred)):
        if p_idx not in pred_eval_map:
            # Check max IoU even if below threshold
            max_iou = max([iou_matrix[g][p_idx] for g in range(len(norm_gt))]) if norm_gt else 0.0
            status = "incorrect_localization" if max_iou >= loc_error_threshold else "false_positive"
            pred_eval_map[p_idx] = {
                "bbox": norm_pred[p_idx]["bbox"],
                "text": norm_pred[p_idx]["text"],
                "confidence": norm_pred[p_idx]["confidence"],
                "status": status,
                "iou": round(max_iou, 4),
                "matched_gt_id": None,
            }

    tp_count = sum(1 for item in pred_eval_map.values() if item["status"] == "correct")
    fp_count = sum(1 for item in pred_eval_map.values() if item["status"] in ("false_positive", "incorrect_localization"))
    fn_count = len(norm_gt) - sum(1 for status in gt_eval_map.values() if status == "detected")

    precision = tp_count / (tp_count + fp_count) if (tp_count + fp_count) > 0 else 0.0
    recall = tp_count / len(norm_gt) if norm_gt else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    mean_word_iou = sum(pair_ious) / len(pair_ious) if pair_ious else 0.0

    gt_eval_list = []
    for g_idx, g in enumerate(norm_gt):
        gt_eval_list.append({
            "id": g["id"],
            "bbox": g["bbox"],
            "text": g["text"],
            "status": gt_eval_map.get(g_idx, "false_negative"),
        })

    pred_eval_list = [pred_eval_map[i] for i in range(len(norm_pred))]

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "mean_word_iou": round(mean_word_iou, 4),
        "true_positives": tp_count,
        "false_positives": fp_count,
        "false_negatives": fn_count,
        "total_gt": len(norm_gt),
        "total_pred": len(norm_pred),
        "pred_eval": pred_eval_list,
        "gt_eval": gt_eval_list,
    }


def align_transcription_words(gt_text: str, pred_text: str) -> Dict[str, Any]:
    """
    Perform word-level alignment between ground truth and predicted text.
    Classifies words as:
    - 'correct': Exact or normalized match
    - 'substitution': Incorrect word
    - 'deletion': Missing word (in GT but omitted in OCR)
    - 'insertion': Extra word (in OCR but not in GT)
    """
    gt_words = [w.strip() for w in gt_text.split() if w.strip()]
    pred_words = [w.strip() for w in pred_text.split() if w.strip()]

    matcher = difflib.SequenceMatcher(None, gt_words, pred_words)
    opcodes = matcher.get_opcodes()

    aligned_gt = []
    aligned_pred = []
    substitutions = 0
    deletions = 0
    insertions = 0
    correct = 0

    for tag, i1, i2, j1, j2 in opcodes:
        if tag == "equal":
            for w in gt_words[i1:i2]:
                aligned_gt.append({"word": w, "type": "correct"})
                correct += 1
            for w in pred_words[j1:j2]:
                aligned_pred.append({"word": w, "type": "correct"})
        elif tag == "replace":
            g_chunk = gt_words[i1:i2]
            p_chunk = pred_words[j1:j2]
            max_len = max(len(g_chunk), len(p_chunk))
            for k in range(max_len):
                gw = g_chunk[k] if k < len(g_chunk) else None
                pw = p_chunk[k] if k < len(p_chunk) else None
                if gw and pw:
                    aligned_gt.append({"word": gw, "type": "substitution", "paired_with": pw})
                    aligned_pred.append({"word": pw, "type": "substitution", "paired_with": gw})
                    substitutions += 1
                elif gw:
                    aligned_gt.append({"word": gw, "type": "deletion"})
                    deletions += 1
                elif pw:
                    aligned_pred.append({"word": pw, "type": "insertion"})
                    insertions += 1
        elif tag == "delete":
            for w in gt_words[i1:i2]:
                aligned_gt.append({"word": w, "type": "deletion"})
                deletions += 1
        elif tag == "insert":
            for w in pred_words[j1:j2]:
                aligned_pred.append({"word": w, "type": "insertion"})
                insertions += 1

    n_gt = len(gt_words)
    wer = round((substitutions + deletions + insertions) / n_gt, 4) if n_gt > 0 else 0.0

    return {
        "aligned_gt": aligned_gt,
        "aligned_pred": aligned_pred,
        "counts": {
            "correct": correct,
            "substitutions": substitutions,
            "deletions": deletions,
            "insertions": insertions,
            "total_gt": n_gt,
            "total_pred": len(pred_words),
            "wer": wer,
        }
    }
