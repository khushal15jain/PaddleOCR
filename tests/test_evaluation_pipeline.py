import json
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from scripts.evaluate import evaluate
from src.ocr_benchmark.evaluation.metrics import calculate_metrics
from src.ocr_benchmark.evaluation.statistics import _holm_correct, _bootstrap_median_diff_ci


def test_perfect_hypothesis_yields_zero_cer_and_wer():
    gt = "LETTER NO. 001 Dear Margaret Lewis, Document ID: IMG_001"
    metrics = calculate_metrics(gt, gt)
    assert metrics["cer"] == 0.0
    assert metrics["wer"] == 0.0


def test_empty_hypothesis_handling():
    gt = "Historical Document Transcription Text"
    # None hypothesis (engine crash)
    m_none = calculate_metrics(gt, None)
    assert m_none["cer"] is None
    assert m_none["wer"] is None

    # Empty string hypothesis (engine returned nothing)
    m_empty = calculate_metrics(gt, "")
    assert m_empty["cer"] == 1.0
    assert m_empty["wer"] == 1.0

    # Whitespace hypothesis
    m_space = calculate_metrics(gt, "   ")
    assert m_space["cer"] == 1.0
    assert m_space["wer"] == 1.0


def test_synthetic_ground_truth_contains_header_and_footer():
    gt_path = Path("data/ground_truth/IMG_001.txt")
    if gt_path.exists():
        content = gt_path.read_text(encoding="utf-8").strip()
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        assert len(lines) >= 3
        # First line is header
        assert "LETTER NO. 001" in lines[0]
        # Last line is footer
        assert "Document ID: IMG_001" in lines[-1]


def test_holm_bonferroni_correction():
    # p-values: smallest p=0.005 should pass (0.005 < 0.05 / 3 = 0.0167),
    # second p=0.02 should pass (0.02 < 0.05 / 2 = 0.025),
    # third p=0.10 should fail (0.10 > 0.05 / 1 = 0.05)
    p_vals = [0.005, 0.10, 0.02]
    sig = _holm_correct(p_vals, alpha=0.05)
    assert sig[0] is True   # 0.005
    assert sig[1] is False  # 0.10
    assert sig[2] is True   # 0.02

    # All insignificant
    p_insig = [0.6, 0.7, 0.8]
    assert _holm_correct(p_insig, alpha=0.05) == [False, False, False]

    # Empty
    assert _holm_correct([], alpha=0.05) == []


def test_bootstrap_median_diff_ci():
    rng = np.random.default_rng(42)
    diffs = rng.normal(loc=0.05, scale=0.01, size=50)
    low, high = _bootstrap_median_diff_ci(diffs, n_iterations=500, seed=42)

    assert not np.isnan(low)
    assert not np.isnan(high)
    assert low < high
    median = np.median(diffs)
    assert low <= median <= high

    # Empty array handling
    e_low, e_high = _bootstrap_median_diff_ci(np.array([]), n_iterations=100)
    assert np.isnan(e_low) and np.isnan(e_high)


def test_evaluate_end_to_end_on_fixture_images():
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        gt_dir = tmp / "gt"
        gt_dir.mkdir(parents=True)
        annot_dir = tmp / "annotations"
        annot_dir.mkdir(parents=True)
        out_dir = tmp / "outputs"
        paddle_out = out_dir / "paddleocr"
        paddle_out.mkdir(parents=True)
        tess_out = out_dir / "tesseract"
        tess_out.mkdir(parents=True)

        meta_file = tmp / "metadata.csv"
        meta_df = pd.DataFrame([
            {"image_id": "TEST_001", "document_type": "letter", "degradation_type": "clean"},
            {"image_id": "TEST_002", "document_type": "letter", "degradation_type": "blur"},
            {"image_id": "TEST_003", "document_type": "newspaper", "degradation_type": "noise"},
        ])
        meta_df.to_csv(meta_file, index=False)

        fixtures = [
            ("TEST_001", "Dear John, hello from London. Document ID: TEST_001"),
            ("TEST_002", "Public notice regarding annual fair. Document ID: TEST_002"),
            ("TEST_003", "Market report prices steady. Document ID: TEST_003"),
        ]

        for img_id, text in fixtures:
            (gt_dir / f"{img_id}.txt").write_text(text, encoding="utf-8")
            (paddle_out / f"{img_id}.json").write_text(
                json.dumps({
                    "image_id": img_id,
                    "engine": "PaddleOCR",
                    "status": "success",
                    "empty_result": False,
                    "text": text,
                    "runtime_seconds": 1.2,
                    "words": [{"text": w, "confidence": 0.99, "bbox": [10, 10, 50, 30]} for w in text.split()],
                }),
                encoding="utf-8",
            )
            (tess_out / f"{img_id}.json").write_text(
                json.dumps({
                    "image_id": img_id,
                    "engine": "Tesseract",
                    "status": "success",
                    "empty_result": False,
                    "text": text,
                    "runtime_seconds": 0.3,
                    "words": [{"text": w, "confidence": 0.95, "bbox": [10, 10, 50, 30]} for w in text.split()],
                }),
                encoding="utf-8",
            )
            (annot_dir / f"{img_id}.json").write_text(
                json.dumps([
                    {"image_id": img_id, "word_id": f"w_{i}", "transcription": w, "x_min": 10, "y_min": 10, "x_max": 50, "y_max": 30, "confidence": 1.0}
                    for i, w in enumerate(text.split())
                ]),
                encoding="utf-8",
            )

        config = {
            "dataset": {
                "name": "test_fixture",
                "language": "en",
                "ground_truth_dir": str(gt_dir),
                "annotations_dir": str(annot_dir),
                "metadata_file": str(meta_file),
            },
            "output_dir": str(out_dir),
            "evaluation": {
                "modes": ["strict", "normalized"],
                "iou_threshold": 0.5,
            },
        }

        evaluate(config)

        per_doc = out_dir / "metrics" / "per_document_results.csv"
        summary = out_dir / "metrics" / "summary.csv"

        assert per_doc.exists()
        assert summary.exists()

        df_per_doc = pd.read_csv(per_doc)
        assert len(df_per_doc) == 6  # 3 images * 2 modes
        assert "degradation_type" in df_per_doc.columns
        assert df_per_doc["paddle_cer"].mean() == 0.0
        assert df_per_doc["tesseract_cer"].mean() == 0.0

        df_summary = pd.read_csv(summary)
        assert not df_summary.empty
        assert "Engine" in df_summary.columns
        assert "Stratification" in df_summary.columns
