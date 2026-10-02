from pathlib import Path

import streamlit as st
import yaml
from PIL import Image

st.set_page_config(page_title="Ground Truth Annotation", layout="wide")
st.title("📝 Historical French OCR - Manual Annotation")

config = yaml.safe_load(Path("configs/config.yaml").read_text(encoding="utf-8"))
IMG_DIR = Path(config["dataset"]["image_dir"])
GT_DIR = Path(config["dataset"]["ground_truth_dir"])
GT_DIR.mkdir(parents=True, exist_ok=True)

valid_extensions = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
image_files = sorted(
    f for f in IMG_DIR.iterdir() if f.is_file() and f.suffix.lower() in valid_extensions
) if IMG_DIR.exists() else []

if not image_files:
    st.error(f"No images found in {IMG_DIR}. Please add images first.")
    st.stop()

total_images = len(image_files)


def _is_annotated(img: Path) -> bool:
    gt_path = GT_DIR / f"{img.stem}.txt"
    return gt_path.exists() and gt_path.read_text(encoding="utf-8").strip() != ""


annotated_count = sum(1 for img in image_files if _is_annotated(img))
st.progress(annotated_count / total_images)
st.write(f"**Progress**: {annotated_count} / {total_images} images annotated.")

if "current_index" not in st.session_state:
    st.session_state.current_index = 0

col1, col2, col3 = st.columns([1, 2, 1])
with col1:
    if st.button("⬅️ Previous Image") and st.session_state.current_index > 0:
        st.session_state.current_index -= 1
        st.rerun()
with col3:
    if st.button("Next Image ➡️") and st.session_state.current_index < total_images - 1:
        st.session_state.current_index += 1
        st.rerun()

current_img_path = image_files[st.session_state.current_index]
gt_path = GT_DIR / f"{current_img_path.stem}.txt"

st.subheader(f"Current Image: {current_img_path.name} ({st.session_state.current_index + 1}/{total_images})")

col_img, col_text = st.columns([1, 1])

with col_img:
    img = Image.open(current_img_path)
    st.image(img, use_container_width=True, caption="Zoom with your browser if needed")

with col_text:
    st.markdown(
        """
    **Transcription Rules**:
    - Preserve original spelling, accents, and punctuation.
    - `[UNCLEAR]` : Text is readable but uncertain.
    - `[ILLEGIBLE]` : Text cannot be read at all.
    - `[?]` : A single uncertain character.
    """
    )

    existing_text = gt_path.read_text(encoding="utf-8") if gt_path.exists() else ""
    status = "Completed" if existing_text.strip() else "Not Annotated"
    st.info(f"Status: **{status}**")

    user_text = st.text_area("Transcription", value=existing_text, height=400)

    if st.button("💾 Save Transcription", type="primary"):
        gt_path.write_text(user_text, encoding="utf-8")
        st.success("Saved!")
        if st.session_state.current_index < total_images - 1:
            st.session_state.current_index += 1
            st.rerun()
        else:
            st.balloons()
            st.success("All images annotated!")
