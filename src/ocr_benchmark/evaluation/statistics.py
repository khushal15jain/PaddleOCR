import logging
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from scipy import stats


def _holm_correct(p_values: List[float], alpha: float) -> List[bool]:
    """
    Holm-Bonferroni step-down correction. Returns, for each input p-value in
    its ORIGINAL order, whether it is significant.
    """
    m = len(p_values)
    order = np.argsort(p_values)
    significant = [False] * m
    for rank, idx in enumerate(order):
        adjusted_alpha = alpha / (m - rank)
        if p_values[idx] < adjusted_alpha:
            significant[idx] = True
        else:
            break  # Holm stops at the first non-rejection
    return significant


def _bootstrap_median_diff_ci(diff: np.ndarray, n_iterations: int, seed: int = 42) -> (float, float):
    if len(diff) == 0:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    boots = rng.choice(diff, size=(n_iterations, len(diff)), replace=True)
    medians = np.median(boots, axis=1)
    return (float(np.percentile(medians, 2.5)), float(np.percentile(medians, 97.5)))


def perform_statistical_tests(config: Dict[str, Any]):
    """
    Paired Wilcoxon signed-rank tests (PaddleOCR vs Tesseract) per mode and
    document type, with rank-biserial effect sizes, median differences, and
    a bootstrap 95% CI on the median difference.

    Holm-Bonferroni correction is applied WITHIN each metric family
    (accuracy: CER/WER, and separately: runtime) rather than across all
    tests pooled together, since correcting a runtime comparison alongside
    an accuracy comparison as if they were one family of hypotheses
    understates significance for both.
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

    def compute_stats(mode, doc_type, metric_name, family, col1, col2):
        subset = df[(df["mode"] == mode) & (df["document_type"] == doc_type)]
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
            # All differences are exactly zero
            stat, p_val, effect_size = 0.0, 1.0, 0.0

        return {
            "mode": mode,
            "document_type": doc_type,
            "metric": metric_name,
            "family": family,
            "N": n,
            "statistic": float(stat),
            "p_value": float(p_val),
            "median_difference_paddle_minus_tesseract": median_diff,
            "median_diff_ci_low": ci_low,
            "median_diff_ci_high": ci_high,
            "effect_size_rank_biserial": effect_size,
        }

    for mode in df["mode"].unique():
        for doc_type in df["document_type"].unique():
            for metric_name, col1, col2 in [
                ("CER", "paddle_cer", "tesseract_cer"),
                ("WER", "paddle_wer", "tesseract_wer"),
            ]:
                res = compute_stats(mode, doc_type, metric_name, "accuracy", col1, col2)
                if res:
                    test_results.append(res)

            res_rt = compute_stats(mode, doc_type, "Runtime", "runtime", "paddle_runtime", "tesseract_runtime")
            if res_rt:
                test_results.append(res_rt)

    if not test_results:
        logging.warning("Not enough valid paired data for statistical tests.")
        pd.DataFrame(
            columns=[
                "mode", "document_type", "metric", "family", "N", "statistic", "p_value",
                "median_difference_paddle_minus_tesseract", "median_diff_ci_low", "median_diff_ci_high",
                "effect_size_rank_biserial", "significant",
            ]
        ).to_csv(metrics_out / "statistical_tests.csv", index=False)
        return

    stats_df = pd.DataFrame(test_results)
    stats_df["significant"] = False
    for family in stats_df["family"].unique():
        mask = stats_df["family"] == family
        stats_df.loc[mask, "significant"] = _holm_correct(stats_df.loc[mask, "p_value"].tolist(), alpha)

    stats_df = stats_df.sort_values(by=["family", "p_value"]).reset_index(drop=True)
    stats_df.to_csv(metrics_out / "statistical_tests.csv", index=False)
    logging.info("Statistical tests complete. Results saved to outputs/metrics/statistical_tests.csv")
