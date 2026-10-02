import jiwer
from typing import Dict, Optional


def calculate_metrics(reference: Optional[str], hypothesis: Optional[str]) -> Dict[str, Optional[float]]:
    """
    Calculate Character Error Rate (CER) and Word Error Rate (WER).

    - If reference is missing/empty: returns None (invalid ground truth;
      never fabricate an error rate against nothing).
    - If hypothesis is None: returns None (OCR failed outright; a crash
      should not be scored as a 100% error rate, it should be excluded
      and reported as a failure).
    - If hypothesis is "" but OCR succeeded (engine ran, found no text):
      returns cer=1.0, wer=1.0, since every reference character/word was
      missed. This is a real result and is deliberately not confused with
      the "OCR crashed" case above.

    Uses jiwer.cer / jiwer.wer directly rather than the removed
    jiwer.compute_measures (deprecated/removed in jiwer 4.x).
    """
    if not reference or not reference.strip():
        return {"cer": None, "wer": None}

    if hypothesis is None:
        return {"cer": None, "wer": None}

    if not hypothesis.strip():
        return {"cer": 1.0, "wer": 1.0}

    cer = jiwer.cer(reference, hypothesis)
    wer = jiwer.wer(reference, hypothesis)

    return {"cer": round(float(cer), 4), "wer": round(float(wer), 4)}
