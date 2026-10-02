import json
import logging
from pathlib import Path

import pandas as pd
from tabulate import tabulate

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def generate_report():
    out_dir = Path("outputs/reports")
    out_dir.mkdir(parents=True, exist_ok=True)
    report_path = out_dir / "research_report.md"

    metrics_dir = Path("outputs/metrics")
    summary_path = metrics_dir / "summary.csv"
    stats_path = metrics_dir / "statistical_tests.csv"
    validation_path = metrics_dir / "dataset_validation.json"

    report_content = [
        "# Research Report: Historical Document OCR (Handwritten vs Printed)",
        "## Abstract",
        "This report evaluates and compares PaddleOCR and Tesseract on printed and handwritten historical documents.",
        "",
    ]

    matched = None
    total = None
    if validation_path.exists():
        validation = json.loads(validation_path.read_text(encoding="utf-8"))
        matched = validation.get("matched_pairs")
        total = validation.get("total_images")
        report_content.append("## Dataset")
        report_content.append(
            f"- {matched}/{total} images have verified, non-empty ground truth.\n"
            f"- Missing ground truth: {len(validation.get('missing_ground_truth', []))}\n"
            f"- Invalid/empty ground truth: {len(validation.get('invalid_files', []))}"
        )
        report_content.append("")

    has_data = False
    if summary_path.exists() and summary_path.stat().st_size > 0:
        summary_df = pd.read_csv(summary_path)
        if not summary_df.empty and summary_df["Valid_N"].sum() > 0:
            has_data = True
            report_content.append("## Summary Statistics")
            report_content.append(tabulate(summary_df, headers="keys", tablefmt="pipe", showindex=False))
            report_content.append("")
        else:
            report_content.append("**Warning:** Summary table has no rows with valid (ground-truth-backed) results.")
    else:
        report_content.append("**Warning:** No summary statistics available.")

    if stats_path.exists() and stats_path.stat().st_size > 0:
        stats_df = pd.read_csv(stats_path)
        if not stats_df.empty:
            report_content.append("## Statistical Significance")
            report_content.append(
                "Holm-Bonferroni correction (alpha=0.05) applied separately within the accuracy "
                "family (CER, WER) and the runtime family, since pooling correction across "
                "unrelated metric families is overly conservative for both."
            )
            report_content.append(tabulate(stats_df, headers="keys", tablefmt="pipe", showindex=False))
            report_content.append("")
        else:
            report_content.append("## Statistical Significance")
            report_content.append("Not enough valid paired data to compute statistics.")
            report_content.append("")

    report_content.append("## Conclusion")
    if has_data:
        report_content.append(
            f"The pipeline ran successfully on {matched}/{total} images with verified ground truth. "
            "See the summary and significance tables above for engine comparisons. Results for images "
            "without ground truth are excluded rather than assumed."
        )
    else:
        report_content.append(
            "**No conclusion can be drawn.** The tables above are empty or contain no valid rows, "
            "which means human-verified ground truth was unavailable for any image, or both OCR "
            "engines failed to run. Populate `data/ground_truth/*.txt` (see `scripts/annotate_ui.py`) "
            "and re-run the pipeline before drawing any conclusions from this report."
        )

    report_path.write_text("\n".join(report_content), encoding="utf-8")
    logging.info(f"Report generated at {report_path}")


if __name__ == "__main__":
    generate_report()
