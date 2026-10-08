# Backend

    pip install -r backend/requirements.txt
    uvicorn backend.main:app --port 8000      # run from the repo root

Defaults (override with env vars OCR_REPO_ROOT, OCR_IMAGES_DIR, OCR_GT_DIR, OCR_GT_EXT, OCR_OUTPUT_DIR):
images `data/raw/images`, ground truth `data/ground_truth/<id>.txt`, outputs `outputs/`.
Record edits (type, notes, flags) are saved to backend/records.json.
