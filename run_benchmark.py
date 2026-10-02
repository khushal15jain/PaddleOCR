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


def main():
    parser = argparse.ArgumentParser(description="Historical French OCR Benchmark")
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Continue even if dataset validation fails (missing/empty ground truth). "
        "Useful for iterating on the pipeline before annotation is complete; "
        "any conclusions drawn from a partial run should be treated as provisional.",
    )
    args = parser.parse_args()

    logging.info("=========================================")
    logging.info("Starting Historical French OCR Benchmark")
    logging.info("=========================================")

    config_path = "configs/config.yaml"
    if not Path(config_path).exists():
        logging.error(f"Missing config: {config_path}")
        sys.exit(1)

    config = yaml.safe_load(Path(config_path).read_text(encoding="utf-8"))

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
