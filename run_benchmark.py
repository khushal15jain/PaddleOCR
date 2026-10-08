import argparse
import logging
import os
import sys
from pathlib import Path

import yaml

# Ensure local tessdata is found regardless of what's installed system-wide.
_local_tessdata = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tessdata")
if os.path.exists(_local_tessdata):
    os.environ["TESSDATA_PREFIX"] = _local_tessdata

from scripts.evaluate import evaluate
from scripts.generate_plots import generate_plots
from scripts.generate_report import generate_report
from scripts.run_ocr import run_ocr
from src.ocr_benchmark.dataset.validator import DatasetValidator
from src.ocr_benchmark.evaluation.statistics import perform_statistical_tests

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def configure_dataset_and_languages(config, dataset_override=None):
    if dataset_override:
        datasets = config.get("datasets", {})
        if dataset_override in datasets:
            config["dataset"] = datasets[dataset_override]
        else:
            logging.error(f"Unknown dataset '{dataset_override}'. Available: {list(datasets.keys())}")
            sys.exit(1)

    ds = config.setdefault("dataset", {})
    ds_lang = ds.get("language", "en")

    # Derive PaddleOCR and Tesseract languages dynamically
    paddle_lang = "en" if ds_lang == "en" else "fr"
    tess_lang = "eng" if ds_lang == "en" else "fra"

    config.setdefault("paddleocr", {})["lang"] = paddle_lang
    config.setdefault("tesseract", {})["language"] = tess_lang
    if "tesseract_preprocessed" in config:
        config["tesseract_preprocessed"]["language"] = tess_lang

    return config


def main():
    parser = argparse.ArgumentParser(description="Reproducible Historical Document OCR Benchmark")
    parser.add_argument(
        "--dataset",
        type=str,
        default=None,
        help="Dataset to benchmark: 'synthetic_en' or 'historical_fr' (overrides configs/config.yaml default)",
    )
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Continue even if dataset validation fails (missing/empty ground truth). "
        "Useful for iterating on the pipeline before annotation is complete; "
        "any conclusions drawn from a partial run should be treated as provisional.",
    )
    args = parser.parse_args()

    config_path = "configs/config.yaml"
    if not Path(config_path).exists():
        logging.error(f"Missing config: {config_path}")
        sys.exit(1)

    config = yaml.safe_load(Path(config_path).read_text(encoding="utf-8"))
    config = configure_dataset_and_languages(config, args.dataset)

    ds_name = config.get("dataset", {}).get("name", "dataset")
    ds_lang = config.get("dataset", {}).get("language", "en")

    logging.info("=========================================")
    logging.info(f"Starting OCR Benchmark: {ds_name} (language: {ds_lang})")
    logging.info("=========================================")

    logging.info("--- PHASE 1: DATASET VALIDATION ---")
    validator = DatasetValidator(config)
    if not validator.validate():
        if not args.allow_partial:
            logging.error(
                "CRITICAL: Validation failed (see outputs/metrics/dataset_validation.json). "
                "Add missing images/ground truth, or re-run with --allow-partial to proceed anyway."
            )
            sys.exit(1)
        logging.warning("Validation failed but --allow-partial was set. Continuing with a partial dataset.")

    logging.info("--- PHASE 2: RUNNING OCR ---")
    run_ocr(config)

    logging.info("--- PHASE 3: EVALUATION ---")
    evaluate(config)

    logging.info("--- PHASE 4: STATISTICAL ANALYSIS ---")
    perform_statistical_tests(config)

    logging.info("--- PHASE 5: VISUALIZATION ---")
    generate_plots()

    logging.info("--- PHASE 6: REPORT GENERATION ---")
    generate_report()

    logging.info("=========================================")
    logging.info("Benchmark complete! Check outputs/reports/research_report.md")
    logging.info("=========================================")


if __name__ == "__main__":
    main()
