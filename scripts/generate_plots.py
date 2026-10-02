import logging
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def _placeholder(out_dir, reason):
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.text(0.5, 0.5, reason, ha="center", va="center", fontsize=14, wrap=True)
    ax.set_axis_off()
    plt.tight_layout()
    plt.savefig(out_dir / "placeholder_error.png")
    plt.savefig(out_dir / "placeholder_error.pdf")
    plt.close("all")


def generate_plots():
    out_dir = Path("outputs/figures")
    out_dir.mkdir(parents=True, exist_ok=True)

    metrics_file = Path("outputs/metrics/per_document_results.csv")
    if not metrics_file.exists() or metrics_file.stat().st_size == 0:
        logging.warning("Metrics file not found or empty. Generating placeholder plot.")
        _placeholder(out_dir, "No metrics available (run evaluate.py first)")
        return

    df = pd.read_csv(metrics_file)
    if df.empty or "paddle_cer" not in df.columns or df["paddle_cer"].isna().all():
        logging.warning("No valid metric data available. Generating placeholder plot.")
        _placeholder(out_dir, "Insufficient data (missing ground truth)")
        return

    sns.set_theme(style="whitegrid")

    for mode in df["mode"].unique():
        mode_df = df[df["mode"] == mode]

        for metric, label in [("cer", "CER"), ("wer", "WER")]:
            cols = [f"paddle_{metric}", f"tesseract_{metric}", "document_type"]
            data = mode_df[cols].dropna()
            if data.empty:
                continue
            melted = data.melt(id_vars=["document_type"], var_name="Engine", value_name=label)
            melted["Engine"] = melted["Engine"].replace(
                {f"paddle_{metric}": "PaddleOCR", f"tesseract_{metric}": "Tesseract"}
            )
            plt.figure(figsize=(12, 6))
            sns.boxplot(data=melted, x="Engine", y=label, hue="document_type")
            plt.title(f"{label} ({'Character' if metric == 'cer' else 'Word'} Error Rate) - {mode.title()} Mode")
            plt.ylabel(f"{label} (lower is better)")
            plt.tight_layout()
            plt.savefig(out_dir / f"fig_{metric}_{mode}.png", dpi=300)
            plt.savefig(out_dir / f"fig_{metric}_{mode}.pdf")
            plt.close("all")

    # Runtime is mode-independent (OCR only runs once), so plot it separately.
    rt_data = df[df["mode"] == df["mode"].unique()[0]][
        ["paddle_runtime", "tesseract_runtime", "document_type"]
    ].dropna()
    if not rt_data.empty:
        melted = rt_data.melt(id_vars=["document_type"], var_name="Engine", value_name="Runtime (s)")
        melted["Engine"] = melted["Engine"].replace(
            {"paddle_runtime": "PaddleOCR", "tesseract_runtime": "Tesseract"}
        )
        plt.figure(figsize=(12, 6))
        sns.boxplot(data=melted, x="Engine", y="Runtime (s)", hue="document_type")
        plt.title("Per-image Runtime by Engine")
        plt.tight_layout()
        plt.savefig(out_dir / "fig_runtime.png", dpi=300)
        plt.savefig(out_dir / "fig_runtime.pdf")
        plt.close("all")


if __name__ == "__main__":
    generate_plots()
