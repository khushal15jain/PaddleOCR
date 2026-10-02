import json
import tempfile
from pathlib import Path

import pytest

from src.ocr_benchmark.dataset.validator import DatasetValidator


def _write(path: Path, content: bytes = b"fake"):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_validator_passes_on_matched_clean_dataset():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        _write(tmp / "images" / "IMG_001.jpg")
        (tmp / "gt").mkdir()
        (tmp / "gt" / "IMG_001.txt").write_text("Bonjour", encoding="utf-8")

        config = {
            "dataset": {"image_dir": str(tmp / "images"), "ground_truth_dir": str(tmp / "gt")},
            "output_dir": str(tmp / "outputs"),
        }
        validator = DatasetValidator(config)
        assert validator.validate() is True

        report = json.loads((tmp / "outputs" / "metrics" / "dataset_validation.json").read_text())
        assert report["matched_pairs"] == 1


def test_validator_fails_on_empty_ground_truth():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        _write(tmp / "images" / "IMG_001.jpg")
        (tmp / "gt").mkdir()
        (tmp / "gt" / "IMG_001.txt").write_text("", encoding="utf-8")

        config = {
            "dataset": {"image_dir": str(tmp / "images"), "ground_truth_dir": str(tmp / "gt")},
            "output_dir": str(tmp / "outputs"),
        }
        validator = DatasetValidator(config)
        assert validator.validate() is False

        report = json.loads((tmp / "outputs" / "metrics" / "dataset_validation.json").read_text())
        assert report["matched_pairs"] == 0
        assert len(report["invalid_files"]) == 1


def test_validator_fails_on_missing_image_dir():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        config = {
            "dataset": {"image_dir": str(tmp / "nope"), "ground_truth_dir": str(tmp / "gt")},
            "output_dir": str(tmp / "outputs"),
        }
        assert DatasetValidator(config).validate() is False


def test_tesseract_engine_importable():
    from src.ocr_benchmark.engines.tesseract_engine import TesseractRunner
    assert TesseractRunner is not None


def test_paddleocr_engine_importable_when_package_present():
    pytest.importorskip("paddleocr", reason="paddleocr not installed in this environment")
    from src.ocr_benchmark.engines.paddleocr_engine import PaddleRunner
    assert PaddleRunner is not None
