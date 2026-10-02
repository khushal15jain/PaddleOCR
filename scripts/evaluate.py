import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

from src.ocr_benchmark.evaluation.metrics import calculate_metrics
from src.ocr_benchmark.evaluation.normalization import normalize_text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def evaluate(config):
    gt_dir = Path(config["dataset"]["ground_truth_dir"])
    out_dir = Path(config.get("output_dir", "outputs"))
    paddle_out = out_dir / "paddleocr"
    tesseract_out = out_dir / "tesseract"
    metrics_out = out_dir / "metrics"
    metrics_out.mkdir(parents=True, exist_ok=True)

    modes = config["evaluation"].get("modes", ["strict", "normalized"])

    gt_files = [p for p in gt_dir.glob("*.txt") if p.read_text(encoding="utf-8").strip()]
    if not gt_files:
        logging.error("No non-empty ground truth files found for evaluation.")
        # Still emit empty artifacts so downstream steps don't crash on missing files.
        pd.DataFrame().to_csv(metrics_out / "per_document_results.csv", index=False)
        pd.DataFrame().to_csv(metrics_out / "summary.csv", index=False)
        return

    try:
        metadata_df = pd.read_csv(config["dataset"].get("metadata_file", "data/metadata.csv"))
        metadata_dict = dict(zip(metadata_df["image_id"], metadata_df["document_type"]))
    except Exception:
        metadata_dict = {}

    results = []
    for gt_path in gt_files:
        img_id = gt_path.stem
        doc_type = metadata_dict.get(img_id, "unknown")
        raw_gt = gt_path.read_text(encoding="utf-8")

        paddle_json = paddle_out / f"{img_id}.json"
        tess_json = tesseract_out / f"{img_id}.json"

        paddle_data = json.loads(paddle_json.read_text(encoding="utf-8")) if paddle_json.exists() else {}
        tess_data = json.loads(tess_json.read_text(encoding="utf-8")) if tess_json.exists() else {}

        for mode in modes:
            strict_flag = mode == "strict"
            gt_norm = normalize_text(raw_gt, strict=strict_flag)

            p_text = paddle_data.get("text", "") if paddle_data.get("status") == "success" else None
            t_text = tess_data.get("text", "") if tess_data.get("status") == "success" else None

            p_pred = normalize_text(p_text, strict=strict_flag) if p_text is not None else None
            t_pred = normalize_text(t_text, strict=strict_flag) if t_text is not None else None

            p_metrics = calculate_metrics(gt_norm, p_pred)
            t_metrics = calculate_metrics(gt_norm, t_pred)

            results.append({
                "image_id": img_id,
                "document_type": doc_type,
                "mode": mode,
                "paddle_status": paddle_data.get("status", "missing"),
                "tesseract_status": tess_data.get("status", "missing"),
                "paddle_empty_result": paddle_data.get("empty_result"),
                "tesseract_empty_result": tess_data.get("empty_result"),
                "paddle_cer": p_metrics.get("cer"),
                "tesseract_cer": t_metrics.get("cer"),
                "paddle_wer": p_metrics.get("wer"),
                "tesseract_wer": t_metrics.get("wer"),
                "paddle_runtime": paddle_data.get("runtime_seconds"),
                "tesseract_runtime": tess_data.get("runtime_seconds"),
                "paddle_confidence": paddle_data.get("average_confidence"),
                "tesseract_confidence": tess_data.get("average_confidence"),
            })

    df = pd.DataFrame(results)
    df.to_csv(metrics_out / "per_document_results.csv", index=False)

    def get_summary_row(mode, engine, prefix, doc_type):
        mode_df = df[(df["mode"] == mode) & (df["document_type"] == doc_type)]
        valid_df = mode_df.dropna(subset=[f"{prefix}_cer"])
        n = len(mode_df)
        successes = len(valid_df)
        return {
            "mode": mode,
            "Document Type": doc_type,
            "Engine": engine,
            "N": n,
            "Valid_N": successes,
            "Failure Rate": (n - successes) / n if n > 0 else np.nan,
            "CER Mean": valid_df[f"{prefix}_cer"].mean(),
            "CER Std": valid_df[f"{prefix}_cer"].std(),
            "CER Median": valid_df[f"{prefix}_cer"].median(),
            "CER IQR": (valid_df[f"{prefix}_cer"].quantile(0.75) - valid_df[f"{prefix}_cer"].quantile(0.25))
            if successes > 0 else np.nan,
            "WER Mean": valid_df[f"{prefix}_wer"].mean(),
            "WER Std": valid_df[f"{prefix}_wer"].std(),
            "WER Median": valid_df[f"{prefix}_wer"].median(),
            "WER IQR": (valid_df[f"{prefix}_wer"].quantile(0.75) - valid_df[f"{prefix}_wer"].quantile(0.25))
            if successes > 0 else np.nan,
            "Runtime Mean": valid_df[f"{prefix}_runtime"].mean(),
            "Runtime Std": valid_df[f"{prefix}_runtime"].std(),
            "Confidence Mean": valid_df[f"{prefix}_confidence"].mean(),
            "Confidence Std": valid_df[f"{prefix}_confidence"].std(),
        }

    summary_data = []
    for mode in modes:
        for doc_type in df["document_type"].unique():
            summary_data.append(get_summary_row(mode, "PaddleOCR", "paddle", doc_type))
            summary_data.append(get_summary_row(mode, "Tesseract", "tesseract", doc_type))

    pd.DataFrame(summary_data).to_csv(metrics_out / "summary.csv", index=False)
    logging.info("Evaluation complete. Results saved to outputs/metrics/")


if __name__ == "__main__":
    with open("configs/config.yaml", "r") as f:
        evaluate(yaml.safe_load(f))
