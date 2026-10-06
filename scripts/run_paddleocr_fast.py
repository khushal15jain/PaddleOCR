import cv2
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

from paddleocr import PaddleOCR


def process_image_fast(ocr, img_path: Path):
    start_time = time.time()
    img = cv2.imread(str(img_path))
    if img is None:
        raise ValueError(f"Could not read image: {img_path}")

    h, w = img.shape[:2]
    # Scale so max side is 960 for fast CPU inference
    scale = 960.0 / max(h, w)
    resized = cv2.resize(img, (int(w * scale), int(h * scale)))

    temp_path = f"/tmp/{img_path.stem}_ocr_tmp.png"
    cv2.imwrite(temp_path, resized)

    result = ocr.predict(temp_path)
    runtime = time.time() - start_time

    try:
        os.remove(temp_path)
    except Exception:
        pass

    words = []
    full_text = []
    confidences = []

    if result and isinstance(result, list) and len(result) > 0:
        res_dict = result[0]
        rec_texts = res_dict.get("rec_texts", [])
        rec_scores = res_dict.get("rec_scores", [])
        dt_polys = res_dict.get("dt_polys", [])

        for i in range(len(rec_texts)):
            txt = str(rec_texts[i]).strip()
            conf = float(rec_scores[i])
            poly = dt_polys[i] if i < len(dt_polys) else [[0, 0], [0, 0], [0, 0], [0, 0]]

            # Map coordinates back to original image space
            xs = [p[0] / scale for p in poly]
            ys = [p[1] / scale for p in poly]
            bbox = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

            parts = txt.split()
            if len(parts) <= 1:
                words.append({"text": txt, "confidence": round(conf, 4), "bbox": bbox})
            else:
                span = max(1, bbox[2] - bbox[0])
                total_len = max(1, len(txt))
                cur_x = bbox[0]
                for part in parts:
                    ww = max(8, int(span * (len(part) / total_len)))
                    words.append({
                        "text": part,
                        "confidence": round(conf, 4),
                        "bbox": [cur_x, bbox[1], min(bbox[2], cur_x + ww), bbox[3]],
                    })
                    cur_x += ww + int(span * (1 / total_len))

            full_text.append(txt)
            confidences.append(conf)

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "image_id": img_path.stem,
        "engine": "PaddleOCR",
        "status": "success",
        "empty_result": len(full_text) == 0,
        "text": " ".join(full_text),
        "translated_text_en": "[TRANSLATION SKIPPED]",
        "runtime_seconds": round(runtime, 4),
        "word_count": len(words),
        "average_confidence": round(avg_conf, 4),
        "words": words,
    }


def main():
    target_ids = sys.argv[1].split(",") if len(sys.argv) > 1 else None
    img_dir = REPO_ROOT / "data" / "raw" / "images"
    out_dir = REPO_ROOT / "outputs" / "paddleocr"
    out_dir.mkdir(parents=True, exist_ok=True)

    if target_ids:
        imgs = [img_dir / f"{i}.png" for i in target_ids if (img_dir / f"{i}.png").exists()]
    else:
        imgs = sorted([p for p in img_dir.glob("IMG_*.png")])

    print(f"Fast PaddleOCR starting for {len(imgs)} images...")
    ocr = PaddleOCR(
        lang="en",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

    t_start = time.time()
    for idx, p in enumerate(imgs):
        out_json = out_dir / f"{p.stem}.json"
        if out_json.exists():
            continue
        try:
            res = process_image_fast(ocr, p)
            out_json.write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
            elapsed = time.time() - t_start
            print(f"[{idx+1}/{len(imgs)}] {p.stem} finished in {res['runtime_seconds']}s | words: {res['word_count']} (total elapsed: {elapsed:.0f}s)", flush=True)
        except Exception as e:
            print(f"Error processing {p.stem}: {e}", flush=True)

    print("Fast PaddleOCR run completed!")


if __name__ == "__main__":
    main()
