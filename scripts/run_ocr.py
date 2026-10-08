import argparse
import concurrent.futures
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

import yaml
from tqdm import tqdm

from src.ocr_benchmark.engines.paddleocr_engine import PaddleRunner
from src.ocr_benchmark.engines.tesseract_engine import TesseractRunner

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

VALID_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}


def _is_cached_success(json_path: Path) -> bool:
    """A cached result only counts as done if it previously succeeded."""
    if not json_path.exists():
        return False
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f).get("status") == "success"
    except Exception:
        return False


def _process_single_image(engine, img_path: Path, output_dir: Path, repeats: int):
    json_path = output_dir / f"{img_path.stem}.json"
    if _is_cached_success(json_path):
        return False, None

    best_result = None
    min_runtime = float("inf")

    for _ in range(repeats):
        result = engine.process_image(img_path)
        if result.get("status") == "failed":
            best_result = result
            break
        rt = result.get("runtime_seconds") or float("inf")
        if rt < min_runtime:
            min_runtime = rt
            best_result = result

    if best_result:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(best_result, f, indent=4, ensure_ascii=False)
        return True, best_result
    return False, None


def run_ocr(config: Dict[str, Any], workers: int = 1):
    image_dir = Path(config["dataset"]["image_dir"])
    out_dir = Path(config.get("output_dir", "outputs"))

    image_files = sorted(
        f for f in image_dir.iterdir() if f.is_file() and f.suffix.lower() in VALID_EXTENSIONS
    )

    if not image_files:
        logging.error(f"No images found in {image_dir} to process.")
        return

    engine_specs = []
    engine_names = config.get("engines", ["paddleocr", "tesseract"])

    if "paddleocr" in engine_names:
        engine_specs.append(("PaddleOCR", lambda: PaddleRunner(config), out_dir / "paddleocr"))

    if "tesseract" in engine_names:
        engine_specs.append(
            (
                "Tesseract",
                lambda: TesseractRunner(config, engine_name="Tesseract", config_key="tesseract"),
                out_dir / "tesseract",
            )
        )

    if "tesseract_preprocessed" in engine_names:
        engine_specs.append(
            (
                "Tesseract (preprocessed)",
                lambda: TesseractRunner(
                    config, engine_name="Tesseract (preprocessed)", config_key="tesseract_preprocessed"
                ),
                out_dir / "tesseract_preprocessed",
            )
        )

    repeats = config.get("runtime", {}).get("repeats", 1)

    for eng_name, eng_factory, output_dir in engine_specs:
        output_dir.mkdir(parents=True, exist_ok=True)

        # Determine how many need processing
        pending = [p for p in image_files if not _is_cached_success(output_dir / f"{p.stem}.json")]
        if not pending:
            logging.info(f"{eng_name}: all {len(image_files)} images already cached.")
            continue

        logging.info(f"Starting {eng_name} processing -> {output_dir}...")
        logging.info(f"{eng_name}: processing {len(pending)}/{len(image_files)} images (workers={workers})...")
        engine = eng_factory()

        if workers > 1 and engine.engine_name != "PaddleOCR":
            # Tesseract is thread-safe and benefits cleanly from ThreadPool
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {
                    executor.submit(_process_single_image, engine, img_p, output_dir, repeats): img_p
                    for img_p in pending
                }
                for fut in tqdm(
                    concurrent.futures.as_completed(futures),
                    total=len(futures),
                    desc=f"{engine.engine_name}",
                ):
                    fut.result()
        else:
            for img_path in tqdm(pending, desc=f"{engine.engine_name}"):
                _process_single_image(engine, img_path, output_dir, repeats)

        logging.info(f"{engine.engine_name}: completed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run OCR engines on benchmark images")
    parser.add_argument("--config", default="configs/config.yaml", help="Path to config file")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker threads")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    run_ocr(cfg, workers=args.workers)
