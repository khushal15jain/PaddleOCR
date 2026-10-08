import logging
import os
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "mpl"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def _placeholder(out_dir: Path, reason: str):
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.text(0.5, 0.5, reason, ha="center", va="center", fontsize=14, wrap=True)
    ax.set_axis_off()
    plt.tight_layout()
    plt.savefig(out_dir / "placeholder_error.png")
    plt.savefig(out_dir / "placeholder_error.pdf")
    plt.close("all")


def generate_plots(config: Optional[Dict[str, Any]] = None):
    out_base = Path(config.get("output_dir", "outputs")) if config else Path("outputs")
    out_dir = out_base / "figures"
    out_dir.mkdir(parents=True, exist_ok=True)

    metrics_file = out_base / "metrics" / "per_document_results.csv"
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

    has_prep = "tesseract_prep_cer" in df.columns

    for mode in df["mode"].unique():
        mode_df = df[df["mode"] == mode]

        for metric, label in [("cer", "CER"), ("wer", "WER")]:
            engine_map = {
                f"paddle_{metric}": "PaddleOCR",
                f"tesseract_{metric}": "Tesseract (raw)",
            }
            if has_prep:
                engine_map[f"tesseract_prep_{metric}"] = "Tesseract (preprocessed)"

            cols = list(engine_map.keys()) + ["document_type"]
            data = mode_df[[c for c in cols if c in mode_df.columns]].dropna(subset=[f"paddle_{metric}"])
            if not data.empty:
                melted = data.melt(id_vars=["document_type"], var_name="Engine", value_name=label)
                melted["Engine"] = melted["Engine"].replace(engine_map)
                plt.figure(figsize=(12, 6))
                sns.boxplot(data=melted, x="Engine", y=label, hue="document_type")
                plt.title(f"{label} Comparison by Document Type ({mode.title()} Mode)")
                plt.ylabel(f"{label} (lower is better)")
                plt.tight_layout()
                plt.savefig(out_dir / f"fig_{metric}_{mode}_doctype.png", dpi=300)
                plt.savefig(out_dir / f"fig_{metric}_{mode}_doctype.pdf")
                plt.close("all")

            # Also plot by degradation_type
            if "degradation_type" in mode_df.columns:
                cols_deg = list(engine_map.keys()) + ["degradation_type"]
                data_deg = mode_df[[c for c in cols_deg if c in mode_df.columns]].dropna(subset=[f"paddle_{metric}"])
                if not data_deg.empty:
                    melted_deg = data_deg.melt(id_vars=["degradation_type"], var_name="Engine", value_name=label)
                    melted_deg["Engine"] = melted_deg["Engine"].replace(engine_map)
                    plt.figure(figsize=(14, 6))
                    sns.boxplot(data=melted_deg, x="Engine", y=label, hue="degradation_type")
                    plt.title(f"{label} Comparison by Degradation Type ({mode.title()} Mode)")
                    plt.ylabel(f"{label} (lower is better)")
                    plt.tight_layout()
                    plt.savefig(out_dir / f"fig_{metric}_{mode}_degradation.png", dpi=300)
                    plt.savefig(out_dir / f"fig_{metric}_{mode}_degradation.pdf")
                    plt.close("all")

    # Runtime boxplot
    first_mode = df["mode"].unique()[0] if "mode" in df.columns else "strict"
    rt_cols = ["paddle_runtime", "tesseract_runtime"]
    rt_map = {"paddle_runtime": "PaddleOCR", "tesseract_runtime": "Tesseract (raw)"}
    if "tesseract_prep_runtime" in df.columns:
        rt_cols.append("tesseract_prep_runtime")
        rt_map["tesseract_prep_runtime"] = "Tesseract (preprocessed)"

    rt_data = df[df["mode"] == first_mode][rt_cols + ["document_type"]].dropna(subset=["paddle_runtime"])
    if not rt_data.empty:
        melted = rt_data.melt(id_vars=["document_type"], var_name="Engine", value_name="Runtime (s)")
        melted["Engine"] = melted["Engine"].replace(rt_map)
        plt.figure(figsize=(12, 6))
        sns.boxplot(data=melted, x="Engine", y="Runtime (s)", hue="document_type")
        plt.title("Per-Image Runtime Comparison by Engine (CPU)")
        plt.tight_layout()
        plt.savefig(out_dir / "fig_runtime.png", dpi=300)
        plt.savefig(out_dir / "fig_runtime.pdf")
        plt.close("all")


if __name__ == "__main__":
    generate_plots()
