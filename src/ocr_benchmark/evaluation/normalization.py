import unicodedata
import re


def normalize_text(text: str, strict: bool = False) -> str:
    """
    Normalize text for evaluation.

    If strict=True:
        Returns the text stripping leading/trailing whitespace.
        Preserves all historical spelling, punctuation, and capitalization.

    If strict=False:
        - Unicode normalization (NFKC)
        - Lowercases the text
        - Strips punctuation but preserves letters (including accents) and
          hyphens/apostrophes inside words
        - Collapses multiple spaces into one
    """
    if not text:
        return ""

    if strict:
        return text.strip()

    text = unicodedata.normalize("NFKC", text)
    text = text.lower()

    # \w matches any alphanumeric character including unicode (accents),
    # so this strips punctuation while keeping accented letters, hyphens
    # and apostrophes.
    text = re.sub(r"[^\w\s'-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text
