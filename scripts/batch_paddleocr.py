import os
import sys
import time
import json
from pathlib import Path
import multiprocessing as mp
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
os.environ["PADDLE_PDX_CACHE_HOME"] = str(REPO_ROOT / ".paddlex")
os.environ["MPLCONFIGDIR"] = "/tmp/mpl"
os.environ["OCR_BENCHMARK_SKIP_TRANSLATION"] = "1"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def run_worker(img_list, worker_id):
    os.environ["PADDLE_PDX_CACHE_HOME"] = str(REPO_ROOT / ".paddlex")
    os.environ["MPLCONFIGDIR"] = "/tmp/mpl"
    os.environ["OCR_BENCHMARK_SKIP_TRANSLATION"] = "1"

    from src.ocr_benchmark.engines.paddleocr_engine import PaddleRunner
    runner = PaddleRunner({
        "paddleocr": {
            "lang": "en",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
        }
    })

    out_dir = REPO_ROOT / "outputs" / "paddleocr"
    out_dir.mkdir(parents=True, exist_ok=True)

    for idx, img_id in enumerate(img_list):
        p = REPO_ROOT / "data" / "raw" / "images" / f"{img_id}.png"
        if not p.exists():
            continue
        target_json = out_dir / f"{img_id}.json"
        t0 = time.time()
        res = runner.process_image(p)
        dt = time.time() - t0
        target_json.write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[Worker {worker_id}] ({idx+1}/{len(img_list)}) {img_id} done in {dt:.1f}s | words: {res.get('word_count', 0)}")


def main():
    imgs = sorted([p.stem for p in (REPO_ROOT / "data" / "raw" / "images").glob("IMG_*.png")])
    out_dir = REPO_ROOT / "outputs" / "paddleocr"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Check already processed
    to_process = [i for i in imgs if not (out_dir / f"{i}.json").exists()]
    print(f"Total images: {len(imgs)}, to process: {len(to_process)}")

    if not to_process:
        print("All images already processed!")
        return

    num_workers = min(5, len(to_process))
    chunks = [to_process[i::num_workers] for i in range(num_workers)]

    procs = []
    t_start = time.time()
    for w_id, chunk in enumerate(chunks):
        if not chunk:
            continue
        p = mp.Process(target=run_worker, args=(chunk, w_id + 1))
        p.start()
        procs.append(p)

    for p in procs:
        p.join()

    total_time = time.time() - t_start
    print(f"\nAll {len(to_process)} images completed in {total_time:.1f}s ({total_time/60:.2f} min)!")

    # Populate data/paddleocr_results.csv
    csv_rows = []
    for img_id in imgs:
        f = out_dir / f"{img_id}.json"
        if f.exists():
            data = json.loads(f.read_text(encoding="utf-8"))
            for i, w in enumerate(data.get("words", [])):
                b = w.get("bbox", [0, 0, 0, 0])
                csv_rows.append({
                    "image_id": img_id,
                    "line_id": 1,
                    "word_id": i + 1,
                    "recognized_text": w.get("text", ""),
                    "confidence": round(w.get("confidence", 0.0), 4),
                    "x_min": b[0],
                    "y_min": b[1],
                    "x_max": b[2],
                    "y_max": b[3],
                    "processing_time_ms": int(data.get("runtime_seconds", 0) * 1000),
                })

    pd.DataFrame(csv_rows).to_csv(REPO_ROOT / "data" / "paddleocr_results.csv", index=False)
    print(f"Wrote data/paddleocr_results.csv with {len(csv_rows)} words.")


if __name__ == "__main__":
    main()
