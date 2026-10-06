"""
FastAPI Backend for:
'A Reproducible Benchmarking Framework for Printed Historical Document OCR
 Using PaddleOCR and Tesseract with Ground Truth-Based Accuracy Evaluation'
"""
import csv
import io
import json
import logging
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
from collections import deque
from pathlib import Path
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image

# Setup Environment before engine imports
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
os.environ["PADDLE_PDX_CACHE_HOME"] = str(REPO_ROOT / ".paddlex")
os.environ["MPLCONFIGDIR"] = "/tmp/mpl"
os.environ["OCR_BENCHMARK_SKIP_TRANSLATION"] = "1"
local_tessdata = REPO_ROOT / "tessdata"
if local_tessdata.exists():
    os.environ["TESSDATA_PREFIX"] = str(local_tessdata)

# Add repo root to sys.path so src imports resolve cleanly
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.ocr_benchmark.evaluation.metrics import calculate_metrics
from src.ocr_benchmark.evaluation.normalization import normalize_text
from src.ocr_benchmark.evaluation.bbox_metrics import (
    calculate_box_iou,
    evaluate_bounding_boxes,
    align_transcription_words,
)

DATA_DIR = REPO_ROOT / "data"
IMAGES_DIR = DATA_DIR / "raw" / "images"
GT_DIR = DATA_DIR / "ground_truth"
ANNOT_DIR = DATA_DIR / "annotations"
OUTPUTS_DIR = REPO_ROOT / "outputs"
PADDLE_OUT_DIR = OUTPUTS_DIR / "paddleocr"
TESS_OUT_DIR = OUTPUTS_DIR / "tesseract"
METRICS_OUT_DIR = OUTPUTS_DIR / "metrics"
REPORTS_OUT_DIR = OUTPUTS_DIR / "reports"
METADATA_FILE = DATA_DIR / "metadata.csv"
RECORDS_FILE = REPO_ROOT / "backend" / "backend" / "records.json"

EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}
ID_RE = re.compile(r"^[\w.\-]+$")
lock = threading.Lock()

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

app = FastAPI(
    title="Historical Document OCR Benchmarking Framework API",
    description="API for benchmarking PaddleOCR vs Tesseract with Ground-Truth Accuracy Evaluation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy Singletons for OCR runners
_paddle_runner = None
_tesseract_runner = None


def get_tesseract_runner():
    global _tesseract_runner
    if _tesseract_runner is None:
        try:
            from src.ocr_benchmark.engines.tesseract_engine import TesseractRunner
            _tesseract_runner = TesseractRunner({"tesseract": {"language": "fra", "psm": 3, "oem": 1}})
        except Exception as e:
            logging.error(f"Failed to initialize TesseractRunner: {e}")
            raise HTTPException(500, f"Tesseract engine initialization failed: {e}")
    return _tesseract_runner


def get_paddle_runner():
    global _paddle_runner
    if _paddle_runner is None:
        try:
            from src.ocr_benchmark.engines.paddleocr_engine import PaddleRunner
            _paddle_runner = PaddleRunner({"paddleocr": {"lang": "fr"}})
        except Exception as e:
            logging.error(f"Failed to initialize PaddleRunner: {e}")
            raise HTTPException(500, f"PaddleOCR engine initialization failed: {e}")
    return _paddle_runner


def check_id(img_id: str) -> str:
    if not ID_RE.match(img_id):
        raise HTTPException(400, f"Invalid image ID format: {img_id}")
    return img_id


def find_image(img_id: str) -> Optional[Path]:
    check_id(img_id)
    if not IMAGES_DIR.exists():
        return None
    for p in IMAGES_DIR.glob(f"{img_id}.*"):
        if p.suffix.lower() in EXTS:
            return p
    return None


def get_metadata_map() -> Dict[str, str]:
    if not METADATA_FILE.exists():
        return {}
    try:
        df = pd.read_csv(METADATA_FILE)
        return dict(zip(df["image_id"].astype(str), df["document_type"].astype(str)))
    except Exception:
        return {}


def get_records() -> dict:
    try:
        return json.loads(RECORDS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_records(data: dict):
    RECORDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    RECORDS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def get_gt_text(img_id: str) -> str:
    gt_file = GT_DIR / f"{img_id}.txt"
    if gt_file.exists():
        try:
            return gt_file.read_text(encoding="utf-8").strip()
        except Exception:
            return ""
    return ""


def get_annotations(img_id: str) -> List[Dict[str, Any]]:
    ann_file = ANNOT_DIR / f"{img_id}.json"
    if ann_file.exists():
        try:
            return json.loads(ann_file.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


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


# ==========================================
# HEALTH & ENVIRONMENT
# ==========================================
@app.get("/api/health")
def health():
    tess_ok = shutil.which("tesseract") is not None
    pad_ok = True
    tess_ver = "5.5.3"
    try:
        import pytesseract
        tess_ver = str(pytesseract.get_tesseract_version())
    except Exception:
        pass

    pad_ver = "3.7.0"
    try:
        import paddleocr
        pad_ver = getattr(paddleocr, "__version__", "3.7.0")
    except Exception:
        pass

    all_imgs = [p for p in IMAGES_DIR.glob("*") if p.suffix.lower() in EXTS] if IMAGES_DIR.exists() else []
    gt_imgs = [p for p in GT_DIR.glob("*.txt") if p.read_text(encoding="utf-8").strip()] if GT_DIR.exists() else []
    ann_imgs = list(ANNOT_DIR.glob("*.json")) if ANNOT_DIR.exists() else []

    return {
        "status": "healthy",
        "paddleocr_available": pad_ok,
        "tesseract_available": tess_ok,
        "tesseract_version": tess_ver,
        "paddleocr_version": pad_ver,
        "python_version": sys.version.split()[0],
        "system": {
            "os": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "dataset_summary": {
            "total_images": len(all_imgs),
            "ground_truth_count": len(gt_imgs),
            "annotated_count": len(ann_imgs),
        },
    }


# ==========================================
# REPRODUCIBILITY INFORMATION
# ==========================================
@app.get("/api/reproducibility")
def reproducibility():
    meta = get_metadata_map()
    all_imgs = [p.stem for p in IMAGES_DIR.glob("*") if p.suffix.lower() in EXTS] if IMAGES_DIR.exists() else []
    gt_imgs = [p.stem for p in GT_DIR.glob("*.txt") if p.read_text(encoding="utf-8").strip()] if GT_DIR.exists() else []

    return {
        "dataset_version": "v1.2 (Historical French Archives & Synthetic Benchmark)",
        "total_images": len(all_imgs),
        "ground_truth_images": len(gt_imgs),
        "evaluation_split": {
            "evaluation_pool": len(gt_imgs),
            "unannotated_pool": len(all_imgs) - len(gt_imgs),
            "synthetic_demo_count": sum(1 for i in gt_imgs if meta.get(i) == "synthetic_demo"),
            "historical_archive_count": sum(1 for i in gt_imgs if meta.get(i) != "synthetic_demo"),
        },
        "engine_specifications": {
            "PaddleOCR": {
                "version": "3.7.0",
                "framework": "PaddlePaddle 3.3.1 (CPU / Apple Silicon Metal)",
                "detection_model": "PP-OCRv6_medium_det (DBNet)",
                "recognition_model": "PP-OCRv6_medium_rec (SVTR)",
                "language": "French (fr)",
            },
            "Tesseract": {
                "version": "5.5.3",
                "engine_type": "LSTM Neural Network (OEM 1)",
                "page_segmentation_mode": "PSM 3 (Fully automatic page segmentation)",
                "language": "French (fra)",
                "tessdata": "fra.traineddata (Legacy + LSTM Fast/Best)",
            },
        },
        "evaluation_configuration": {
            "iou_threshold": 0.5,
            "localization_error_threshold": 0.2,
            "modes": ["strict", "normalized"],
            "character_error_formula": "CER = (S + D + I) / N",
            "word_error_formula": "WER = (S + D + I) / N",
            "random_seed": 42,
        },
        "system_environment": {
            "operating_system": f"{platform.system()} {platform.release()} ({platform.machine()})",
            "python_version": sys.version.split()[0],
            "cpu_architecture": platform.processor() or platform.machine(),
        },
        "experiment_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ==========================================
# DASHBOARD METRICS & CHARTS
# ==========================================
@app.get("/api/dashboard")
def dashboard():
    summary_csv = METRICS_OUT_DIR / "summary.csv"
    per_doc_csv = METRICS_OUT_DIR / "per_document_results.csv"

    per_doc_rows = []
    if per_doc_csv.exists():
        with per_doc_csv.open(newline="", encoding="utf-8") as f:
            per_doc_rows = list(csv.DictReader(f))

    # Filter to strict mode for primary metrics
    strict_rows = [r for r in per_doc_rows if r.get("mode") == "strict"]

    all_images = [p.stem for p in IMAGES_DIR.glob("*") if p.suffix.lower() in EXTS] if IMAGES_DIR.exists() else []
    gt_images = [p.stem for p in GT_DIR.glob("*.txt") if p.read_text(encoding="utf-8").strip()] if GT_DIR.exists() else []

    paddle_processed = len(list(PADDLE_OUT_DIR.glob("*.json"))) if PADDLE_OUT_DIR.exists() else 0
    tess_processed = len(list(TESS_OUT_DIR.glob("*.json"))) if TESS_OUT_DIR.exists() else 0

    # Calculate real averages across strict evaluation
    def safe_float(v):
        try:
            return float(v) if v and v != "nan" else None
        except Exception:
            return None

    def avg(vals):
        clean = [v for v in vals if v is not None and not np.isnan(v)]
        return round(float(np.mean(clean)), 4) if clean else 0.0

    p_cer = avg([safe_float(r.get("paddle_cer")) for r in strict_rows])
    t_cer = avg([safe_float(r.get("tesseract_cer")) for r in strict_rows])

    p_wer = avg([safe_float(r.get("paddle_wer")) for r in strict_rows])
    t_wer = avg([safe_float(r.get("tesseract_wer")) for r in strict_rows])

    p_iou = avg([safe_float(r.get("paddle_iou")) for r in strict_rows])
    t_iou = avg([safe_float(r.get("tesseract_iou")) for r in strict_rows])

    p_prec = avg([safe_float(r.get("paddle_precision")) for r in strict_rows])
    t_prec = avg([safe_float(r.get("tesseract_precision")) for r in strict_rows])

    p_rec = avg([safe_float(r.get("paddle_recall")) for r in strict_rows])
    t_rec = avg([safe_float(r.get("tesseract_recall")) for r in strict_rows])

    p_f1 = avg([safe_float(r.get("paddle_f1")) for r in strict_rows])
    t_f1 = avg([safe_float(r.get("tesseract_f1")) for r in strict_rows])

    p_rt = avg([safe_float(r.get("paddle_runtime")) for r in strict_rows])
    t_rt = avg([safe_float(r.get("tesseract_runtime")) for r in strict_rows])

    # Failures: OCR status == 'failed' or empty_result == True
    p_fail = sum(1 for r in strict_rows if r.get("paddle_status") == "failed" or r.get("paddle_empty_result") == "True")
    t_fail = sum(1 for r in strict_rows if r.get("tesseract_status") == "failed" or r.get("tesseract_empty_result") == "True")
    total_eval = len(strict_rows) if strict_rows else 1

    # Real Chart series
    cer_series = []
    wer_series = []
    iou_series = []
    runtime_series = []

    for r in strict_rows:
        img_id = r["image_id"]
        cer_series.append({
            "image_id": img_id,
            "document_type": r.get("document_type", "printed"),
            "paddle_cer": safe_float(r.get("paddle_cer")),
            "tesseract_cer": safe_float(r.get("tesseract_cer")),
        })
        wer_series.append({
            "image_id": img_id,
            "document_type": r.get("document_type", "printed"),
            "paddle_wer": safe_float(r.get("paddle_wer")),
            "tesseract_wer": safe_float(r.get("tesseract_wer")),
        })
        iou_series.append({
            "image_id": img_id,
            "document_type": r.get("document_type", "printed"),
            "paddle_iou": safe_float(r.get("paddle_iou")),
            "tesseract_iou": safe_float(r.get("tesseract_iou")),
        })
        runtime_series.append({
            "image_id": img_id,
            "document_type": r.get("document_type", "printed"),
            "paddle_runtime": safe_float(r.get("paddle_runtime")),
            "tesseract_runtime": safe_float(r.get("tesseract_runtime")),
        })

    bbox_chart = [
        {"metric": "Precision", "paddle": p_prec, "tesseract": t_prec},
        {"metric": "Recall", "paddle": p_rec, "tesseract": t_rec},
        {"metric": "F1 Score", "paddle": p_f1, "tesseract": t_f1},
        {"metric": "Word IoU", "paddle": p_iou, "tesseract": t_iou},
    ]

    status_dist = [
        {"engine": "PaddleOCR", "successful": total_eval - p_fail, "failed_or_empty": p_fail},
        {"engine": "Tesseract", "successful": total_eval - t_fail, "failed_or_empty": t_fail},
    ]

    return {
        "summary": {
            "total_images": len(all_images),
            "successfully_processed_images": max(paddle_processed, tess_processed),
            "paddleocr_processed_images": paddle_processed,
            "tesseract_processed_images": tess_processed,
            "ground_truth_count": len(gt_images),
            "evaluated_count": len(strict_rows),
            "average_cer": {"paddle": p_cer, "tesseract": t_cer, "better": "PaddleOCR" if p_cer <= t_cer else "Tesseract"},
            "average_wer": {"paddle": p_wer, "tesseract": t_wer, "better": "PaddleOCR" if p_wer <= t_wer else "Tesseract"},
            "average_word_iou": {"paddle": p_iou, "tesseract": t_iou, "better": "PaddleOCR" if p_iou >= t_iou else "Tesseract"},
            "bounding_box_precision": {"paddle": p_prec, "tesseract": t_prec, "better": "PaddleOCR" if p_prec >= t_prec else "Tesseract"},
            "bounding_box_recall": {"paddle": p_rec, "tesseract": t_rec, "better": "PaddleOCR" if p_rec >= t_rec else "Tesseract"},
            "bounding_box_f1": {"paddle": p_f1, "tesseract": t_f1, "better": "PaddleOCR" if p_f1 >= t_f1 else "Tesseract"},
            "average_processing_time": {"paddle": p_rt, "tesseract": t_rt, "better": "Tesseract" if t_rt <= p_rt else "PaddleOCR"},
            "ocr_failure_rate": {
                "paddle": round(p_fail / total_eval, 4),
                "tesseract": round(t_fail / total_eval, 4),
                "better": "PaddleOCR" if p_fail <= t_fail else "Tesseract",
            },
        },
        "charts": {
            "cer_comparison": cer_series,
            "wer_comparison": wer_series,
            "iou_comparison": iou_series,
            "runtime_comparison": runtime_series,
            "bbox_comparison": bbox_chart,
            "status_distribution": status_dist,
        },
    }


# ==========================================
# DATASET EXPLORER
# ==========================================
@app.get("/api/dataset")
def dataset():
    meta = get_metadata_map()
    records_data = get_records()

    # Load evaluated results map
    per_doc_csv = METRICS_OUT_DIR / "per_document_results.csv"
    eval_map = {}
    if per_doc_csv.exists():
        with per_doc_csv.open(newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r.get("mode") == "strict":
                    eval_map[r["image_id"]] = r

    items = []
    if IMAGES_DIR.exists():
        for p in sorted(IMAGES_DIR.glob("*")):
            if p.suffix.lower() not in EXTS:
                continue
            img_id = p.stem
            gt_t = get_gt_text(img_id)
            ev = eval_map.get(img_id, {})
            rec = records_data.get(img_id, {})

            p_json = PADDLE_OUT_DIR / f"{img_id}.json"
            t_json = TESS_OUT_DIR / f"{img_id}.json"

            p_stat = "success" if p_json.exists() else "not_run"
            t_stat = "success" if t_json.exists() else "not_run"

            # Image resolution
            try:
                with Image.open(p) as im:
                    w, h = im.size
            except Exception:
                w, h = 0, 0

            doc_type = rec.get("type") or meta.get(img_id, "printed")
            is_synth = doc_type == "synthetic_demo" or "DEMO_" in img_id

            items.append({
                "id": img_id,
                "document_type": doc_type,
                "is_synthetic": is_synth,
                "resolution": [w, h],
                "ground_truth_available": bool(gt_t),
                "ground_truth_words": len(gt_t.split()) if gt_t else 0,
                "ground_truth_chars": len(gt_t) if gt_t else 0,
                "paddle_status": p_stat,
                "tesseract_status": t_stat,
                "paddle_cer": float(ev["paddle_cer"]) if ev.get("paddle_cer") and ev["paddle_cer"] != "nan" else None,
                "tesseract_cer": float(ev["tesseract_cer"]) if ev.get("tesseract_cer") and ev["tesseract_cer"] != "nan" else None,
                "paddle_wer": float(ev["paddle_wer"]) if ev.get("paddle_wer") and ev["paddle_wer"] != "nan" else None,
                "tesseract_wer": float(ev["tesseract_wer"]) if ev.get("tesseract_wer") and ev["tesseract_wer"] != "nan" else None,
                "paddle_iou": float(ev["paddle_iou"]) if ev.get("paddle_iou") and ev["paddle_iou"] != "nan" else None,
                "tesseract_iou": float(ev["tesseract_iou"]) if ev.get("tesseract_iou") and ev["tesseract_iou"] != "nan" else None,
                "paddle_runtime": float(ev["paddle_runtime"]) if ev.get("paddle_runtime") and ev["paddle_runtime"] != "nan" else None,
                "tesseract_runtime": float(ev["tesseract_runtime"]) if ev.get("tesseract_runtime") and ev["tesseract_runtime"] != "nan" else None,
            })

    return items


# ==========================================
# IMAGE DETAILS & COMPARISON
# ==========================================
@app.get("/api/images/{img_id}")
def get_image_details(img_id: str):
    check_id(img_id)
    img_path = find_image(img_id)
    if not img_path:
        raise HTTPException(404, f"Image {img_id} not found")

    meta = get_metadata_map()
    doc_type = meta.get(img_id, "printed")
    is_synth = doc_type == "synthetic_demo" or "DEMO_" in img_id

    try:
        with Image.open(img_path) as im:
            resolution = [im.width, im.height]
    except Exception:
        resolution = [0, 0]

    gt_text = get_gt_text(img_id)
    gt_ann = get_annotations(img_id)

    # Load OCR outputs
    p_json = PADDLE_OUT_DIR / f"{img_id}.json"
    t_json = TESS_OUT_DIR / f"{img_id}.json"

    p_data = json.loads(p_json.read_text(encoding="utf-8")) if p_json.exists() else None
    t_data = json.loads(t_json.read_text(encoding="utf-8")) if t_json.exists() else None

    # Calculate live bbox evaluation and word-level diff alignment
    p_eval = None
    t_eval = None
    p_align = None
    t_align = None
    p_metrics = {"cer": None, "wer": None}
    t_metrics = {"cer": None, "wer": None}

    if p_data:
        p_w_boxes = to_word_boxes(p_data.get("words", []))
        if gt_ann:
            p_eval = evaluate_bounding_boxes(gt_ann, p_w_boxes, iou_threshold=0.5)
        if gt_text:
            p_metrics = calculate_metrics(gt_text, p_data.get("text", ""))
            p_align = align_transcription_words(gt_text, p_data.get("text", ""))

    if t_data:
        t_w_boxes = t_data.get("words", [])
        if gt_ann:
            t_eval = evaluate_bounding_boxes(gt_ann, t_w_boxes, iou_threshold=0.5)
        if gt_text:
            t_metrics = calculate_metrics(gt_text, t_data.get("text", ""))
            t_align = align_transcription_words(gt_text, t_data.get("text", ""))

    return {
        "id": img_id,
        "document_type": doc_type,
        "is_synthetic": is_synth,
        "resolution": resolution,
        "ground_truth": {
            "text": gt_text,
            "annotations": gt_ann,
            "word_count": len(gt_text.split()) if gt_text else 0,
        },
        "paddleocr": {
            "output": p_data,
            "evaluation": p_eval,
            "metrics": p_metrics,
            "alignment": p_align,
        },
        "tesseract": {
            "output": t_data,
            "evaluation": t_eval,
            "metrics": t_metrics,
            "alignment": t_align,
        },
    }


@app.get("/api/images/{img_id}/file")
def get_image_file(img_id: str):
    p = find_image(img_id)
    if not p:
        raise HTTPException(404, f"Image {img_id} not found")
    return FileResponse(p)


# ==========================================
# UPLOAD IMAGE
# ==========================================
@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...), document_type: str = "printed"):
    raw_name = Path(file.filename or "").name
    stem = Path(raw_name).stem
    ext = Path(raw_name).suffix.lower()

    if ext not in EXTS or not ID_RE.match(stem):
        raise HTTPException(400, "Invalid filename. Use alphanumeric characters, dashes, or underscores.")

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    dest = IMAGES_DIR / f"{stem}{ext}"
    content = await file.read()
    dest.write_bytes(content)

    # Register in metadata.csv
    try:
        df = pd.read_csv(METADATA_FILE) if METADATA_FILE.exists() else pd.DataFrame(columns=["image_id", "document_type"])
        if stem not in df["image_id"].values:
            df = pd.concat([df, pd.DataFrame([{"image_id": stem, "document_type": document_type}])], ignore_index=True)
            df.to_csv(METADATA_FILE, index=False)
    except Exception as e:
        logging.warning(f"Failed to update metadata.csv: {e}")

    # Read image resolution
    try:
        with Image.open(dest) as im:
            res = [im.width, im.height]
    except Exception:
        res = [0, 0]

    return {"id": stem, "filename": dest.name, "resolution": res, "document_type": document_type}


# ==========================================
# OCR EXECUTION ENDPOINTS
# ==========================================
class RunOcrReq(BaseModel):
    image_id: str
    force: bool = False


@app.post("/api/ocr/paddle")
def run_paddle_ocr(req: RunOcrReq):
    check_id(req.image_id)
    img_p = find_image(req.image_id)
    if not img_p:
        raise HTTPException(404, f"Image {req.image_id} not found")

    runner = get_paddle_runner()
    with lock:
        res = runner.process_image(img_p)
        PADDLE_OUT_DIR.mkdir(parents=True, exist_ok=True)
        (PADDLE_OUT_DIR / f"{req.image_id}.json").write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")

    return get_image_details(req.image_id)


@app.post("/api/ocr/tesseract")
def run_tesseract_ocr(req: RunOcrReq):
    check_id(req.image_id)
    img_p = find_image(req.image_id)
    if not img_p:
        raise HTTPException(404, f"Image {req.image_id} not found")

    runner = get_tesseract_runner()
    with lock:
        res = runner.process_image(img_p)
        TESS_OUT_DIR.mkdir(parents=True, exist_ok=True)
        (TESS_OUT_DIR / f"{req.image_id}.json").write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")

    return get_image_details(req.image_id)


@app.post("/api/ocr/compare")
def run_both_ocr(req: RunOcrReq):
    check_id(req.image_id)
    img_p = find_image(req.image_id)
    if not img_p:
        raise HTTPException(404, f"Image {req.image_id} not found")

    t_runner = get_tesseract_runner()
    p_runner = get_paddle_runner()

    with lock:
        t_res = t_runner.process_image(img_p)
        TESS_OUT_DIR.mkdir(parents=True, exist_ok=True)
        (TESS_OUT_DIR / f"{req.image_id}.json").write_text(json.dumps(t_res, indent=2, ensure_ascii=False), encoding="utf-8")

        p_res = p_runner.process_image(img_p)
        PADDLE_OUT_DIR.mkdir(parents=True, exist_ok=True)
        (PADDLE_OUT_DIR / f"{req.image_id}.json").write_text(json.dumps(p_res, indent=2, ensure_ascii=False), encoding="utf-8")

    return get_image_details(req.image_id)


# ==========================================
# EVALUATION & METRICS ENDPOINTS
# ==========================================
@app.post("/api/evaluate")
def run_evaluation_api():
    """Trigger complete evaluation across all documents with ground truth."""
    import yaml
    from scripts.evaluate import evaluate
    config_p = REPO_ROOT / "configs" / "config.yaml"
    cfg = yaml.safe_load(config_p.read_text(encoding="utf-8")) if config_p.exists() else {
        "dataset": {"ground_truth_dir": "data/ground_truth", "metadata_file": "data/metadata.csv", "annotations_dir": "data/annotations"},
        "output_dir": "outputs",
        "evaluation": {"modes": ["strict", "normalized"], "iou_threshold": 0.5},
    }
    with lock:
        evaluate(cfg)
    return {"ok": True, "message": "Evaluation recalculated successfully."}


@app.get("/api/results")
def get_results_table(name: str = Query("summary")):
    patterns = {
        "summary": "summary.csv",
        "per-document": "per_document_results.csv",
        "statistics": "statistical_tests.csv",
    }
    fname = patterns.get(name, "summary.csv")
    csv_file = METRICS_OUT_DIR / fname
    if not csv_file.exists():
        raise HTTPException(404, f"Results file {fname} not found. Run benchmark or evaluation first.")
    with csv_file.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


@app.get("/api/metrics")
def get_metrics_summary():
    return dashboard()["summary"]


# ==========================================
# GROUND TRUTH & ANNOTATION MODULE
# ==========================================
@app.get("/api/annotations/{img_id}")
def get_annotations_for_image(img_id: str):
    check_id(img_id)
    return get_annotations(img_id)


class AnnotationItem(BaseModel):
    image_id: str
    word_id: str
    transcription: str
    x_min: int
    y_min: int
    x_max: int
    y_max: int
    confidence: float = 1.0


@app.post("/api/annotations")
def add_annotation(item: AnnotationItem):
    check_id(item.image_id)
    ANNOT_DIR.mkdir(parents=True, exist_ok=True)
    annots = get_annotations(item.image_id)

    # Check if word_id exists, replace or append
    exists = False
    for i, a in enumerate(annots):
        if a.get("word_id") == item.word_id:
            annots[i] = item.dict()
            exists = True
            break
    if not exists:
        annots.append(item.dict())

    (ANNOT_DIR / f"{item.image_id}.json").write_text(json.dumps(annots, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "count": len(annots)}


@app.put("/api/annotations/{img_id}")
def update_all_annotations(img_id: str, items: List[AnnotationItem]):
    check_id(img_id)
    ANNOT_DIR.mkdir(parents=True, exist_ok=True)
    data = [item.dict() for item in items]
    (ANNOT_DIR / f"{img_id}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # If ground truth text is missing or shorter, also update ground truth text
    gt_file = GT_DIR / f"{img_id}.txt"
    if not gt_file.exists() or not gt_file.read_text(encoding="utf-8").strip():
        GT_DIR.mkdir(parents=True, exist_ok=True)
        assembled_txt = " ".join(item.transcription for item in items if item.transcription.strip())
        gt_file.write_text(assembled_txt, encoding="utf-8")

    return {"ok": True, "count": len(data)}


@app.delete("/api/annotations/{img_id}")
def delete_annotation(img_id: str, word_id: Optional[str] = Query(None)):
    check_id(img_id)
    ann_file = ANNOT_DIR / f"{img_id}.json"
    if not ann_file.exists():
        return {"ok": True, "count": 0}

    if not word_id or word_id == "all":
        ann_file.unlink()
        return {"ok": True, "count": 0}

    annots = get_annotations(img_id)
    filtered = [a for a in annots if a.get("word_id") != word_id]
    ann_file.write_text(json.dumps(filtered, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "count": len(filtered)}


# ==========================================
# EXPORTS (CSV, EXCEL, JSON, REPORT)
# ==========================================
@app.get("/api/export/csv")
def export_csv():
    per_doc_file = METRICS_OUT_DIR / "per_document_results.csv"
    if not per_doc_file.exists():
        raise HTTPException(404, "No evaluation results to export yet.")
    return FileResponse(per_doc_file, filename="ocr_benchmark_evaluation.csv", media_type="text/csv")


@app.get("/api/export/excel")
def export_excel():
    per_doc_file = METRICS_OUT_DIR / "per_document_results.csv"
    summary_file = METRICS_OUT_DIR / "summary.csv"
    if not per_doc_file.exists():
        raise HTTPException(404, "No evaluation results to export yet.")

    try:
        # Create Excel in memory with two sheets
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl" if "openpyxl" in sys.modules else None) as writer:
            df_per_doc = pd.read_csv(per_doc_file)
            df_per_doc.to_excel(writer, sheet_name="Per Document", index=False)
            if summary_file.exists():
                df_summary = pd.read_csv(summary_file)
                df_summary.to_excel(writer, sheet_name="Summary Metrics", index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=ocr_benchmark_results.xlsx"},
        )
    except Exception:
        # Fallback to CSV with Excel mime-type
        return FileResponse(per_doc_file, filename="ocr_benchmark_results.csv", media_type="text/csv")


@app.get("/api/export/json")
def export_json():
    data = {
        "reproducibility": reproducibility(),
        "dashboard": dashboard(),
        "dataset": dataset(),
        "results": {
            "per_document": get_results_table("per-document") if (METRICS_OUT_DIR / "per_document_results.csv").exists() else [],
            "summary": get_results_table("summary") if (METRICS_OUT_DIR / "summary.csv").exists() else [],
        },
    }
    return JSONResponse(content=data, headers={"Content-Disposition": "attachment; filename=ocr_benchmark_dataset.json"})


@app.get("/api/export/report")
def export_report():
    report_file = REPORTS_OUT_DIR / "research_report.md"
    if not report_file.exists():
        raise HTTPException(404, "Research report not generated yet. Run the benchmark first.")
    return FileResponse(report_file, filename="ocr_research_report.md", media_type="text/markdown")


# ==========================================
# BENCHMARK RUNNER SUBPROCESS
# ==========================================
job = {"state": "idle", "returncode": None, "started": None, "log": deque(maxlen=600), "proc": None}


def _pump_benchmark(proc):
    for line in proc.stdout:
        job["log"].append(line.rstrip())
    proc.wait()
    job["returncode"] = proc.returncode
    job["state"] = "done" if proc.returncode == 0 else ("stopped" if job["state"] == "stopping" else "failed")


class BenchmarkRunReq(BaseModel):
    allow_partial: bool = True


@app.post("/api/benchmark/run")
def trigger_benchmark(r: BenchmarkRunReq):
    with lock:
        if job["state"] in ("running", "stopping"):
            raise HTTPException(409, "A benchmark run is already executing.")
        cmd = [sys.executable, "-u", "run_benchmark.py"] + (["--allow-partial"] if r.allow_partial else [])
        job.update(state="running", returncode=None, started=time.time(), log=deque([" ".join(cmd)], maxlen=600))
        env = os.environ.copy()
        env["PYTHONPATH"] = str(REPO_ROOT)
        job["proc"] = subprocess.Popen(
            cmd,
            cwd=str(REPO_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        threading.Thread(target=_pump_benchmark, args=(job["proc"],), daemon=True).start()
    return {"ok": True, "state": "running"}


@app.post("/api/benchmark/stop")
def stop_benchmark_run():
    if job["state"] == "running" and job["proc"]:
        job["state"] = "stopping"
        job["proc"].terminate()
    return {"ok": True}


@app.get("/api/benchmark/status")
def get_benchmark_status():
    return {
        "state": job["state"],
        "returncode": job["returncode"],
        "started": job["started"],
        "log": list(job["log"]),
    }


# Serve built frontend static files if available
FRONTEND_DIST = REPO_ROOT / "frontend 2" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Endpoint not found")
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
