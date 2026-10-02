import os
import logging
import concurrent.futures

# Set OCR_BENCHMARK_SKIP_TRANSLATION=1 to skip network calls entirely (useful
# offline, in CI, or in sandboxes without access to Google's translate
# endpoint). Every OCR result still gets a translated_text_en field so
# downstream code never has to special-case it.
SKIP_TRANSLATION = os.environ.get("OCR_BENCHMARK_SKIP_TRANSLATION", "0") == "1"


def _translate_chunk(translator, chunk):
    return translator.translate(chunk)


def translate_fr_to_en(text: str) -> str:
    """
    Translates French text to English using Google Translator API.
    If text is empty, translation is disabled, or it fails/times out,
    returns a clearly-marked placeholder rather than crashing the caller.
    """
    if not text or not text.strip():
        return ""

    if SKIP_TRANSLATION:
        return "[TRANSLATION SKIPPED]"

    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="fr", target="en")
        chunk_size = 4900
        chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

        translated_chunks = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            for chunk in chunks:
                # 5 second timeout per chunk to prevent rate-limit hanging
                future = executor.submit(_translate_chunk, translator, chunk)
                try:
                    res = future.result(timeout=5.0)
                    if res:
                        translated_chunks.append(res)
                except concurrent.futures.TimeoutError:
                    logging.warning("Translation timed out. Returning original text.")
                    return "[TRANSLATION TIMEOUT] " + text

        return " ".join(translated_chunks)
    except Exception as e:
        logging.warning(f"Translation failed: {e}")
        return "[TRANSLATION ERROR] " + text
