import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats
import yaml

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def _holm_correct(p_values: List[float], alpha: float) -> List[bool]:
    """
    Holm-Bonferroni step-down correction. Returns, for each input p-value in
    its ORIGINAL order, whether it is significant.
    """
    m = len(p_values)
    if m == 0:
        return []
    order = np.argsort(p_values)
    significant = [False] * m
    for rank, idx in enumerate(order):
        adjusted_alpha = alpha / (m - rank)
        if p_values[idx] < adjusted_alpha:
            significant[idx] = True
        else:
            break
    return significant


def _bootstrap_median_diff_ci(diff: np.ndarray, n_iterations: int, seed: int = 42) -> tuple[float, float]:
    if len(diff) == 0:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    boots = rng.choice(diff, size=(n_iterations, len(diff)), replace=True)
    medians = np.median(boots, axis=1)
    return (float(np.percentile(medians, 2.5)), float(np.percentile(medians, 97.5)))


def perform_statistical_tests(config: Dict[str, Any]):
    """
    Paired Wilcoxon signed-rank tests per mode, stratified by both document_type
    and degradation_type, with rank-biserial effect sizes, median differences,
    and bootstrap 95% CIs.

    Holm-Bonferroni correction is applied WITHIN each metric family
    (accuracy: CER/WER, and separately: runtime).
    """
    metrics_out = Path(config.get("output_dir", "outputs")) / "metrics"
    results_path = metrics_out / "per_document_results.csv"

    if not results_path.exists():
        logging.error("No per_document_results.csv found. Run evaluation first.")
        return

    df = pd.read_csv(results_path)
    alpha = config.get("statistics", {}).get("alpha", 0.05)
    n_boot = config.get("statistics", {}).get("bootstrap_iterations", 1000)
    seed = config.get("reproducibility", {}).get("seed", 42)

    test_results = []

    def compute_stats(mode, strat_col, strat_val, comparison, metric_name, family, col1, col2):
        if col1 not in df.columns or col2 not in df.columns:
            return None
        subset = df[(df["mode"] == mode) & (df[strat_col] == strat_val)]
        valid = subset.dropna(subset=[col1, col2])
        n = len(valid)
        if n < 2:
            return None

        x = valid[col1].values
        y = valid[col2].values
        diff = x - y
        median_diff = float(np.median(diff))
        ci_low, ci_high = _bootstrap_median_diff_ci(diff, n_boot, seed)

        try:
            stat, p_val = stats.wilcoxon(x, y, zero_method="wilcox")
            max_w = (n * (n + 1)) / 2
            effect_size = 1 - (2 * stat) / max_w if max_w > 0 else 0.0
        except ValueError:
            stat, p_val, effect_size = 0.0, 1.0, 0.0

        return {
            "mode": mode,
            "stratification": strat_col,
            "group": str(strat_val),
            "comparison": comparison,
            "metric": metric_name,
            "family": family,
            "N": n,
            "statistic": float(stat),
            "p_value": float(p_val),
            "median_difference": median_diff,
            "median_diff_ci_low": ci_low,
            "median_diff_ci_high": ci_high,
            "effect_size_rank_biserial": effect_size,
        }

    comparisons = [
        ("Paddle_vs_TesseractRaw", "paddle", "tesseract"),
    ]
    if "tesseract_prep_cer" in df.columns:
        comparisons.extend([
            ("Paddle_vs_TesseractPrep", "paddle", "tesseract_prep"),
            ("TesseractPrep_vs_TesseractRaw", "tesseract_prep", "tesseract"),
        ])

    modes = df["mode"].unique() if "mode" in df.columns else ["strict"]

    for mode in modes:
        # 1. Stratify by document_type
        if "document_type" in df.columns:
            for doc_type in df["document_type"].dropna().unique():
                for comp_name, p1, p2 in comparisons:
                    for metric_name, m_key in [("CER", "cer"), ("WER", "wer")]:
                        res = compute_stats(
                            mode, "document_type", doc_type, comp_name, metric_name, "accuracy", f"{p1}_{m_key}", f"{p2}_{m_key}"
                        )
                        if res:
                            test_results.append(res)
                    res_rt = compute_stats(
                        mode, "document_type", doc_type, comp_name, "Runtime", "runtime", f"{p1}_runtime", f"{p2}_runtime"
                    )
                    if res_rt:
                        test_results.append(res_rt)

        # 2. Stratify by degradation_type
        if "degradation_type" in df.columns:
            for deg_type in df["degradation_type"].dropna().unique():
                for comp_name, p1, p2 in comparisons:
                    for metric_name, m_key in [("CER", "cer"), ("WER", "wer")]:
                        res = compute_stats(
                            mode, "degradation_type", deg_type, comp_name, metric_name, "accuracy", f"{p1}_{m_key}", f"{p2}_{m_key}"
                        )
                        if res:
                            test_results.append(res)
                    res_rt = compute_stats(
                        mode, "degradation_type", deg_type, comp_name, "Runtime", "runtime", f"{p1}_runtime", f"{p2}_runtime"
                    )
                    if res_rt:
                        test_results.append(res_rt)

    cols = [
        "mode", "stratification", "group", "comparison", "metric", "family", "N", "statistic",
        "p_value", "median_difference", "median_diff_ci_low", "median_diff_ci_high",
        "effect_size_rank_biserial", "significant",
    ]

    if not test_results:
        logging.warning("Not enough valid paired data for statistical tests.")
        pd.DataFrame(columns=cols).to_csv(metrics_out / "statistical_tests.csv", index=False)
        return

    stats_df = pd.DataFrame(test_results)
    stats_df["significant"] = False

    for family in stats_df["family"].unique():
        mask = stats_df["family"] == family
        stats_df.loc[mask, "significant"] = _holm_correct(stats_df.loc[mask, "p_value"].tolist(), alpha)

    stats_df = stats_df.sort_values(by=["family", "p_value"]).reset_index(drop=True)
    stats_df.to_csv(metrics_out / "statistical_tests.csv", index=False)
    logging.info("Statistical tests complete. Saved to outputs/metrics/statistical_tests.csv")


if __name__ == "__main__":
    cfg_path = Path("configs/config.yaml")
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}
    perform_statistical_tests(cfg)
