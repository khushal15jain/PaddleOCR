import json
import os
import sys
import time
from pathlib import Path
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
os.environ["PADDLE_PDX_CACHE_HOME"] = str(REPO_ROOT / ".paddlex")
os.environ["MPLCONFIGDIR"] = "/tmp/mpl"
os.environ["OCR_BENCHMARK_SKIP_TRANSLATION"] = "1"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.ocr_benchmark.engines.paddleocr_engine import PaddleRunner


def main():
    img_dir = REPO_ROOT / "data" / "raw" / "images"
    out_dir = REPO_ROOT / "outputs" / "paddleocr"
    out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted([p for p in img_dir.glob("IMG_*.png")])
    print(f"Total images found: {len(images)}")

    runner = PaddleRunner({
        "paddleocr": {
            "lang": "en",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
        }
    })

    t_start = time.time()
    results_csv_rows = []

    for idx, p in enumerate(images):
        img_id = p.stem
        target_json = out_dir / f"{img_id}.json"
        
        # If already processed and non-empty, load it
        if target_json.exists():
            try:
                res = json.loads(target_json.read_text(encoding="utf-8"))
            except Exception:
                res = runner.process_image(p)
                target_json.write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
        else:
            t0 = time.time()
            res = runner.process_image(p)
            dt = time.time() - t0
            target_json.write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
            elapsed = time.time() - t_start
            avg_per_img = elapsed / (idx + 1)
            remaining = avg_per_img * (len(images) - (idx + 1))
            print(f"[{idx+1}/{len(images)}] {img_id}: words={res.get('word_count', 0)}, time={dt:.1f}s | Elapsed: {elapsed:.0f}s, Est remaining: {remaining/60:.1f}m", flush=True)

        # Append rows for paddleocr_results.csv
        for i, w in enumerate(res.get("words", [])):
            b = w.get("bbox", [0, 0, 0, 0])
            results_csv_rows.append({
                "image_id": img_id,
                "line_id": 1,
                "word_id": i + 1,
                "recognized_text": w.get("text", ""),
                "confidence": round(w.get("confidence", 0.0), 4),
                "x_min": b[0],
                "y_min": b[1],
                "x_max": b[2],
                "y_max": b[3],
                "processing_time_ms": int(res.get("runtime_seconds", 0) * 1000),
            })

    pd.DataFrame(results_csv_rows).to_csv(REPO_ROOT / "data" / "paddleocr_results.csv", index=False)
    print(f"PaddleOCR completed on all {len(images)} images! Total words: {len(results_csv_rows)}")


if __name__ == "__main__":
    main()
