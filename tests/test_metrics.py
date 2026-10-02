from src.ocr_benchmark.evaluation.metrics import calculate_metrics
from src.ocr_benchmark.evaluation.normalization import normalize_text


def test_metrics_perfect_match():
    m = calculate_metrics("bonjour le monde", "bonjour le monde")
    assert m["cer"] == 0.0
    assert m["wer"] == 0.0


def test_metrics_empty_ground_truth_returns_none():
    m = calculate_metrics("", "bonjour")
    assert m["cer"] is None
    assert m["wer"] is None

    m2 = calculate_metrics("   ", "bonjour")
    assert m2["cer"] is None
    assert m2["wer"] is None


def test_metrics_failed_ocr_returns_none():
    m = calculate_metrics("bonjour le monde", None)
    assert m["cer"] is None
    assert m["wer"] is None


def test_metrics_empty_ocr_result_is_full_error():
    m = calculate_metrics("bonjour le monde", "")
    assert m["cer"] == 1.0
    assert m["wer"] == 1.0


def test_metrics_partial_error():
    m = calculate_metrics("bonjour", "bonjor")
    assert 0 < m["cer"] < 1


def test_normalize_strict_preserves_case_and_accents():
    text = "  Château, très joli !  "
    assert normalize_text(text, strict=True) == "Château, très joli !"


def test_normalize_non_strict_lowercases_and_strips_punctuation():
    text = "Château, très joli !"
    result = normalize_text(text, strict=False)
    assert result == "château très joli"


def test_normalize_non_strict_preserves_accents():
    result = normalize_text("Épouse: Élisabeth", strict=False)
    assert "épouse" in result
    assert "élisabeth" in result


def test_normalize_collapses_whitespace():
    result = normalize_text("bonjour    le     monde", strict=False)
    assert result == "bonjour le monde"


def test_normalize_empty_string():
    assert normalize_text("", strict=True) == ""
    assert normalize_text("", strict=False) == ""
