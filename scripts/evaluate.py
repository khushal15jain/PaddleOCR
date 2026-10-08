import csv
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

import numpy as np
import pandas as pd

from src.ocr_benchmark.evaluation.bbox_metrics import (
    calculate_box_iou,
    evaluate_bounding_boxes,
)
from src.ocr_benchmark.evaluation.metrics import calculate_metrics
from src.ocr_benchmark.evaluation.normalization import normalize_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def to_word_boxes(pred_words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert line-level or word-level predictions to discrete word-level bounding boxes."""
    if not pred_words:
        return []
    wb = []
    for p in pred_words:
        txt = p.get("text", "").strip()
        parts = txt.split()
        b = p.get("bbox", [0, 0, 0, 0])
        if len(parts) <= 1:
            wb.append({
                "text": txt,
                "confidence": p.get("confidence", 1.0),
                "bbox": b,
            })
        else:
            span = max(1, b[2] - b[0])
            total_chars = max(1, len(txt))
            cur_x = b[0]
            for part in parts:
                w_w = max(5, int(span * (len(part) / total_chars)))
                wb.append({
                    "text": part,
                    "confidence": p.get("confidence", 1.0),
                    "bbox": [int(cur_x), int(b[1]), int(min(b[2], cur_x + w_w)), int(b[3])],
                })
                cur_x += w_w + int(span * (1 / total_chars))
    return wb


def evaluate(config: Dict[str, Any]):
    gt_dir = Path(config["dataset"]["ground_truth_dir"])
    annot_dir = Path(config["dataset"].get("annotations_dir", "data/annotations"))
    out_dir = Path(config.get("output_dir", "outputs"))
    paddle_out = out_dir / "paddleocr"
    tesseract_out = out_dir / "tesseract"
    tesseract_prep_out = out_dir / "tesseract_preprocessed"
    metrics_out = out_dir / "metrics"
    metrics_out.mkdir(parents=True, exist_ok=True)

    modes = config.get("evaluation", {}).get("modes", ["strict", "normalized"])
    iou_thresh = config.get("evaluation", {}).get("iou_threshold", 0.5)

    gt_files = sorted(p for p in gt_dir.glob("*.txt") if p.read_text(encoding="utf-8").strip())
    if not gt_files:
        logging.error("No non-empty ground truth files found for evaluation.")
        pd.DataFrame().to_csv(metrics_out / "per_document_results.csv", index=False)
        pd.DataFrame().to_csv(metrics_out / "summary.csv", index=False)
        return

    # Metadata map (document_type and degradation_type)
    metadata_file = Path(config["dataset"].get("metadata_file", "data/metadata.csv"))
    documents_file = Path(config["dataset"].get("documents_file", "data/documents.csv"))
    doc_type_map = {}
    deg_type_map = {}

    if metadata_file.exists():
        try:
            m_df = pd.read_csv(metadata_file)
            if "document_type" in m_df.columns:
                doc_type_map.update(dict(zip(m_df["image_id"].astype(str), m_df["document_type"].astype(str))))
            if "degradation_type" in m_df.columns:
                deg_type_map.update(dict(zip(m_df["image_id"].astype(str), m_df["degradation_type"].astype(str))))
        except Exception as e:
            logging.warning(f"Failed to read metadata file: {e}")

    if documents_file.exists():
        try:
            d_df = pd.read_csv(documents_file)
            if "degradation_type" in d_df.columns:
                deg_type_map.update(dict(zip(d_df["image_id"].astype(str), d_df["degradation_type"].astype(str))))
            if "document_type" in d_df.columns and not doc_type_map:
                doc_type_map.update(dict(zip(d_df["image_id"].astype(str), d_df["document_type"].astype(str))))
        except Exception as e:
            logging.warning(f"Failed to read documents file: {e}")

    has_prep_tess = tesseract_prep_out.exists() and any(tesseract_prep_out.glob("*.json"))

    results = []
    for gt_path in gt_files:
        img_id = gt_path.stem
        doc_type = doc_type_map.get(img_id, "printed")
        deg_type = deg_type_map.get(img_id, "clean")
        raw_gt = gt_path.read_text(encoding="utf-8")

        paddle_json = paddle_out / f"{img_id}.json"
        tess_json = tesseract_out / f"{img_id}.json"
        tess_prep_json = tesseract_prep_out / f"{img_id}.json"
        annot_json = annot_dir / f"{img_id}.json"

        paddle_data = json.loads(paddle_json.read_text(encoding="utf-8")) if paddle_json.exists() else {}
        tess_data = json.loads(tess_json.read_text(encoding="utf-8")) if tess_json.exists() else {}
        tess_prep_data = (
            json.loads(tess_prep_json.read_text(encoding="utf-8")) if (has_prep_tess and tess_prep_json.exists()) else {}
        )
        annot_data = json.loads(annot_json.read_text(encoding="utf-8")) if annot_json.exists() else []

        pad_w_boxes = to_word_boxes(paddle_data.get("words", []))
        tess_w_boxes = tess_data.get("words", [])
        tess_prep_w_boxes = tess_prep_data.get("words", [])

        pad_bbox_eval = evaluate_bounding_boxes(annot_data, pad_w_boxes, iou_threshold=iou_thresh) if annot_data else {}
        tess_bbox_eval = evaluate_bounding_boxes(annot_data, tess_w_boxes, iou_threshold=iou_thresh) if annot_data else {}
        tess_prep_bbox_eval = (
            evaluate_bounding_boxes(annot_data, tess_prep_w_boxes, iou_threshold=iou_thresh)
            if (has_prep_tess and annot_data)
            else {}
        )

        for mode in modes:
            strict_flag = mode == "strict"
            gt_norm = normalize_text(raw_gt, strict=strict_flag)

            p_text = paddle_data.get("text", "") if paddle_data.get("status") == "success" else None
            t_text = tess_data.get("text", "") if tess_data.get("status") == "success" else None
            tp_text = tess_prep_data.get("text", "") if tess_prep_data.get("status") == "success" else None

            p_pred = normalize_text(p_text, strict=strict_flag) if p_text is not None else None
            t_pred = normalize_text(t_text, strict=strict_flag) if t_text is not None else None
            tp_pred = normalize_text(tp_text, strict=strict_flag) if tp_text is not None else None

            p_metrics = calculate_metrics(gt_norm, p_pred)
            t_metrics = calculate_metrics(gt_norm, t_pred)
            tp_metrics = calculate_metrics(gt_norm, tp_pred) if has_prep_tess else {}

            row = {
                "image_id": img_id,
                "document_type": doc_type,
                "degradation_type": deg_type,
                "mode": mode,
                "paddle_status": paddle_data.get("status", "missing"),
                "tesseract_status": tess_data.get("status", "missing"),
                "paddle_empty_result": paddle_data.get("empty_result"),
                "tesseract_empty_result": tess_data.get("empty_result"),
                "paddle_cer": p_metrics.get("cer"),
                "tesseract_cer": t_metrics.get("cer"),
                "paddle_wer": p_metrics.get("wer"),
                "tesseract_wer": t_metrics.get("wer"),
                "paddle_iou": pad_bbox_eval.get("mean_word_iou"),
                "tesseract_iou": tess_bbox_eval.get("mean_word_iou"),
                "paddle_precision": pad_bbox_eval.get("precision"),
                "tesseract_precision": tess_bbox_eval.get("precision"),
                "paddle_recall": pad_bbox_eval.get("recall"),
                "tesseract_recall": tess_bbox_eval.get("recall"),
                "paddle_f1": pad_bbox_eval.get("f1"),
                "tesseract_f1": tess_bbox_eval.get("f1"),
                "paddle_runtime": paddle_data.get("runtime_seconds"),
                "tesseract_runtime": tess_data.get("runtime_seconds"),
                "paddle_confidence": paddle_data.get("average_confidence"),
                "tesseract_confidence": tess_data.get("average_confidence"),
            }

            if has_prep_tess:
                row.update({
                    "tesseract_prep_status": tess_prep_data.get("status", "missing"),
                    "tesseract_prep_empty_result": tess_prep_data.get("empty_result"),
                    "tesseract_prep_cer": tp_metrics.get("cer"),
                    "tesseract_prep_wer": tp_metrics.get("wer"),
                    "tesseract_prep_iou": tess_prep_bbox_eval.get("mean_word_iou"),
                    "tesseract_prep_precision": tess_prep_bbox_eval.get("precision"),
                    "tesseract_prep_recall": tess_prep_bbox_eval.get("recall"),
                    "tesseract_prep_f1": tess_prep_bbox_eval.get("f1"),
                    "tesseract_prep_runtime": tess_prep_data.get("runtime_seconds"),
                    "tesseract_prep_confidence": tess_prep_data.get("average_confidence"),
                })

            results.append(row)

    df = pd.DataFrame(results)
    df.to_csv(metrics_out / "per_document_results.csv", index=False)

    def get_summary_row(sub_df, mode, engine, prefix, group_col, group_val):
        valid_df = sub_df.dropna(subset=[f"{prefix}_cer"])
        n = len(sub_df)
        successes = len(valid_df)
        return {
            "mode": mode,
            "Stratification": group_col,
            "Group": group_val,
            "Engine": engine,
            "N": n,
            "Valid_N": successes,
            "Failure Rate": round((n - successes) / n, 4) if n > 0 else np.nan,
            "CER Mean": round(valid_df[f"{prefix}_cer"].mean(), 4) if not valid_df.empty else np.nan,
            "CER Std": round(valid_df[f"{prefix}_cer"].std(), 4) if not valid_df.empty else np.nan,
            "CER Median": round(valid_df[f"{prefix}_cer"].median(), 4) if not valid_df.empty else np.nan,
            "CER IQR": round(
                valid_df[f"{prefix}_cer"].quantile(0.75) - valid_df[f"{prefix}_cer"].quantile(0.25), 4
            ) if not valid_df.empty else np.nan,
            "WER Mean": round(valid_df[f"{prefix}_wer"].mean(), 4) if not valid_df.empty else np.nan,
            "WER Std": round(valid_df[f"{prefix}_wer"].std(), 4) if not valid_df.empty else np.nan,
            "WER Median": round(valid_df[f"{prefix}_wer"].median(), 4) if not valid_df.empty else np.nan,
            "WER IQR": round(
                valid_df[f"{prefix}_wer"].quantile(0.75) - valid_df[f"{prefix}_wer"].quantile(0.25), 4
            ) if not valid_df.empty else np.nan,
            "Word IoU Mean": round(valid_df[f"{prefix}_iou"].mean(), 4) if f"{prefix}_iou" in valid_df and not valid_df.empty else np.nan,
            "Precision Mean": round(valid_df[f"{prefix}_precision"].mean(), 4) if f"{prefix}_precision" in valid_df and not valid_df.empty else np.nan,
            "Recall Mean": round(valid_df[f"{prefix}_recall"].mean(), 4) if f"{prefix}_recall" in valid_df and not valid_df.empty else np.nan,
            "F1 Mean": round(valid_df[f"{prefix}_f1"].mean(), 4) if f"{prefix}_f1" in valid_df and not valid_df.empty else np.nan,
            "Runtime Mean": round(valid_df[f"{prefix}_runtime"].mean(), 4) if not valid_df.empty else np.nan,
            "Runtime Std": round(valid_df[f"{prefix}_runtime"].std(), 4) if not valid_df.empty else np.nan,
            "Confidence Mean": round(valid_df[f"{prefix}_confidence"].mean(), 4) if not valid_df.empty else np.nan,
            "Confidence Std": round(valid_df[f"{prefix}_confidence"].std(), 4) if not valid_df.empty else np.nan,
        }

    summary_data = []
    for mode in modes:
        mode_df = df[df["mode"] == mode]

        # Stratified by document_type
        for doc_type in mode_df["document_type"].unique():
            sub = mode_df[mode_df["document_type"] == doc_type]
            summary_data.append(get_summary_row(sub, mode, "PaddleOCR", "paddle", "document_type", doc_type))
            summary_data.append(get_summary_row(sub, mode, "Tesseract (raw)", "tesseract", "document_type", doc_type))
            if has_prep_tess:
                summary_data.append(get_summary_row(sub, mode, "Tesseract (preprocessed)", "tesseract_prep", "document_type", doc_type))

        # Stratified by degradation_type
        for deg_type in mode_df["degradation_type"].unique():
            sub = mode_df[mode_df["degradation_type"] == deg_type]
            summary_data.append(get_summary_row(sub, mode, "PaddleOCR", "paddle", "degradation_type", deg_type))
            summary_data.append(get_summary_row(sub, mode, "Tesseract (raw)", "tesseract", "degradation_type", deg_type))
            if has_prep_tess:
                summary_data.append(get_summary_row(sub, mode, "Tesseract (preprocessed)", "tesseract_prep", "degradation_type", deg_type))

    pd.DataFrame(summary_data).to_csv(metrics_out / "summary.csv", index=False)
    logging.info("Evaluation complete. Results saved to outputs/metrics/")


if __name__ == "__main__":
    with open("configs/config.yaml", "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    evaluate(cfg)
