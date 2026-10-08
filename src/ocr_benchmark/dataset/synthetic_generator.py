import json
import logging
import os
import random
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import pandas as pd
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
IMAGES_DIR = REPO_ROOT / "data" / "raw" / "images"
GT_DIR = REPO_ROOT / "data" / "ground_truth"
ANNOTATIONS_DIR = REPO_ROOT / "data" / "annotations"


def create_parchment_background(width: int, height: int, aged_intensity: float = 1.0) -> Image.Image:
    """Create a realistic aged historical paper texture with patina and subtle grain."""
    base = Image.new("RGB", (width, height), (244, 237, 222))
    draw = ImageDraw.Draw(base)

    random.seed(42)
    num_spots = int(120 * aged_intensity)
    for _ in range(num_spots):
        cx = random.randint(0, width)
        cy = random.randint(0, height)
        radius = random.randint(20, 150)
        shade = random.randint(215, 240)
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(shade, shade - 8, shade - 20, 15))

    draw.rectangle([15, 15, width - 15, height - 15], outline=(180, 165, 140), width=2)
    draw.rectangle([20, 20, width - 20, height - 20], outline=(200, 185, 160), width=1)

    base = base.filter(ImageFilter.GaussianBlur(radius=0.5))
    return base


def get_serif_font(size: int, bold: bool = False, script: bool = False) -> ImageFont.FreeTypeFont:
    if script:
        candidate_paths = [
            "/System/Library/Fonts/Supplemental/Zapfino.ttf",
            "/System/Library/Fonts/Supplemental/Brush Script.ttf",
            "/System/Library/Fonts/Supplemental/SnellRoundhand.ttc",
            "/System/Library/Fonts/Supplemental/Apple Chancery.ttf",
            "/System/Library/Fonts/Supplemental/Comic Sans MS.ttf",
        ]
        for p in candidate_paths:
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size=size)
                except Exception:
                    pass

    candidate_paths = [
        "/System/Library/Fonts/Times.ttc",
        "/System/Library/Fonts/Palatino.ttc",
        "/Library/Fonts/Times New Roman.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            try:
                index = 1 if (bold and p.endswith(".ttc")) else 0
                return ImageFont.truetype(p, size=size, index=index)
            except Exception:
                pass
    return ImageFont.load_default()


def get_header_words(image_id: str, document_type: str, estimated_year: int) -> List[Tuple[str, List[int]]]:
    """
    Returns the exact words and bounding boxes [x_min, y_min, x_max, y_max]
    rendered in the header (Line 1) for synthetic documents.
    """
    if document_type == "letter":
        num = int(image_id.replace("IMG_", ""))
        return [
            ("LETTER", [627, 157, 857, 207]),
            ("NO.", [895, 157, 1010, 207]),
            (f"{num:03d}", [1048, 157, 1163, 207]),
        ]
    elif document_type == "newspaper":
        yr = str(estimated_year)
        return [
            ("THE", [390, 155, 516, 205]),
            ("COUNTY", [558, 155, 811, 205]),
            ("HERALD", [853, 155, 1106, 205]),
            ("—", [1148, 155, 1190, 205]),
            (yr, [1232, 155, 1400, 205]),
        ]
    elif document_type == "marriage_register":
        return [
            ("MARRIAGE", [532, 160, 876, 202]),
            ("REGISTER", [919, 160, 1263, 202]),
        ]
    elif document_type == "directory":
        yr = str(estimated_year)
        return [
            ("COMMERCIAL", [362, 160, 791, 202]),
            ("DIRECTORY", [833, 160, 1219, 202]),
            (yr, [1261, 160, 1432, 202]),
        ]
    elif document_type == "obituary_card":
        return [
            ("IN", [645, 155, 737, 205]),
            ("MEMORIAM", [783, 155, 1151, 205]),
        ]
    elif document_type == "certificate":
        return [
            ("CERTIFICATE", [465, 160, 919, 202]),
            ("OF", [960, 160, 1042, 202]),
            ("RECORD", [1083, 160, 1330, 202]),
        ]
    elif document_type == "notice":
        yr = str(estimated_year)
        return [
            ("PUBLIC", [497, 160, 737, 202]),
            ("NOTICE", [777, 160, 1017, 202]),
            ("—", [1057, 160, 1097, 202]),
            (yr, [1137, 160, 1297, 202]),
        ]
    return []


def get_footer_words(image_id: str) -> List[Tuple[str, List[int]]]:
    """
    Returns the exact words and bounding boxes [x_min, y_min, x_max, y_max]
    rendered in the footer for synthetic documents.
    """
    return [
        ("Document", [172, 2205, 305, 2242]),
        ("ID:", [321, 2205, 370, 2242]),
        (image_id, [386, 2205, 500, 2242]),
    ]


def regenerate_synthetic_en_ground_truth(
    include_header_footer: bool = True,
    data_dir: Optional[Path] = None,
):
    """
    Regenerates ground truth text and word-level bounding box annotations for the
    100 synthetic English documents (IMG_001..IMG_100) to include the printed header
    and footer exactly as rendered on the physical images.
    """
    base_dir = data_dir or (REPO_ROOT / "data")
    docs_csv = base_dir / "documents.csv"
    gt_csv = base_dir / "ground_truth.csv"
    gt_dir = base_dir / "ground_truth"
    annot_dir = base_dir / "annotations"

    gt_dir.mkdir(parents=True, exist_ok=True)
    annot_dir.mkdir(parents=True, exist_ok=True)

    if not docs_csv.exists() or not gt_csv.exists():
        logging.warning("documents.csv or ground_truth.csv missing; cannot regenerate.")
        return

    docs_df = pd.read_csv(docs_csv)
    raw_gt_df = pd.read_csv(gt_csv)

    all_gt_rows = []
    text_summary_rows = []

    for _, doc_row in docs_df.iterrows():
        img_id = doc_row["image_id"]
        doc_type = doc_row["document_type"]
        year = int(doc_row.get("estimated_year", 1900))

        doc_existing_gt = raw_gt_df[raw_gt_df["image_id"] == img_id].copy()
        doc_existing_gt = doc_existing_gt.sort_values(by=["line_id", "word_id"])

        annotations = []
        full_text_lines = []

        # 1. Header (Line 1)
        if include_header_footer:
            header_items = get_header_words(img_id, doc_type, year)
            if header_items:
                header_words = []
                for widx, (wtext, bbox) in enumerate(header_items, 1):
                    all_gt_rows.append({
                        "image_id": img_id,
                        "line_id": 1,
                        "word_id": widx,
                        "text": wtext,
                        "x_min": bbox[0],
                        "y_min": bbox[1],
                        "x_max": bbox[2],
                        "y_max": bbox[3],
                        "width": bbox[2] - bbox[0],
                        "height": bbox[3] - bbox[1],
                    })
                    annotations.append({
                        "image_id": img_id,
                        "word_id": f"w_1_{widx}",
                        "transcription": wtext,
                        "x_min": bbox[0],
                        "y_min": bbox[1],
                        "x_max": bbox[2],
                        "y_max": bbox[3],
                        "confidence": 1.0,
                    })
                    header_words.append(wtext)
                full_text_lines.append(" ".join(header_words))

        # 2. Body lines (Line 2 .. N)
        max_line = 1
        current_line_id = None
        current_line_words = []

        for _, row in doc_existing_gt.iterrows():
            lid = int(row["line_id"])
            wid = int(row["word_id"])
            wtext = str(row["text"])
            max_line = max(max_line, lid)

            all_gt_rows.append({
                "image_id": img_id,
                "line_id": lid,
                "word_id": wid,
                "text": wtext,
                "x_min": int(row["x_min"]),
                "y_min": int(row["y_min"]),
                "x_max": int(row["x_max"]),
                "y_max": int(row["y_max"]),
                "width": int(row["width"]),
                "height": int(row["height"]),
            })
            annotations.append({
                "image_id": img_id,
                "word_id": f"w_{lid}_{wid}",
                "transcription": wtext,
                "x_min": int(row["x_min"]),
                "y_min": int(row["y_min"]),
                "x_max": int(row["x_max"]),
                "y_max": int(row["y_max"]),
                "confidence": 1.0,
            })

            if lid != current_line_id:
                if current_line_words:
                    full_text_lines.append(" ".join(current_line_words))
                current_line_id = lid
                current_line_words = [wtext]
            else:
                current_line_words.append(wtext)

        if current_line_words:
            full_text_lines.append(" ".join(current_line_words))

        # 3. Footer (Line max_line + 1)
        if include_header_footer:
            footer_line_id = max_line + 1
            footer_items = get_footer_words(img_id)
            footer_words = []
            for widx, (wtext, bbox) in enumerate(footer_items, 1):
                all_gt_rows.append({
                    "image_id": img_id,
                    "line_id": footer_line_id,
                    "word_id": widx,
                    "text": wtext,
                    "x_min": bbox[0],
                    "y_min": bbox[1],
                    "x_max": bbox[2],
                    "y_max": bbox[3],
                    "width": bbox[2] - bbox[0],
                    "height": bbox[3] - bbox[1],
                })
                annotations.append({
                    "image_id": img_id,
                    "word_id": f"w_{footer_line_id}_{widx}",
                    "transcription": wtext,
                    "x_min": bbox[0],
                    "y_min": bbox[1],
                    "x_max": bbox[2],
                    "y_max": bbox[3],
                    "confidence": 1.0,
                })
                footer_words.append(wtext)
            full_text_lines.append(" ".join(footer_words))

        # Write per-image ground truth text file
        full_text = "\n".join(full_text_lines)
        (gt_dir / f"{img_id}.txt").write_text(full_text, encoding="utf-8")

        # Write per-image annotation JSON
        (annot_dir / f"{img_id}.json").write_text(
            json.dumps(annotations, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        text_summary_rows.append({
            "image_id": img_id,
            "ground_truth_text": full_text,
            "character_count": len(full_text),
            "word_count": len(annotations),
            "line_count": len(full_text_lines),
        })

    # Save consolidated CSV files
    pd.DataFrame(all_gt_rows).to_csv(base_dir / "ground_truth.csv", index=False)
    pd.DataFrame(text_summary_rows).to_csv(base_dir / "ground_truth_text.csv", index=False)
    logging.info(f"Regenerated ground truth for {len(docs_df)} images with headers and footers.")


def render_synthetic_document(
    doc_config: Dict[str, Any],
    output_dir: Optional[Path] = None,
    include_header_footer: bool = True,
) -> Tuple[Path, Path, Path]:
    image_id = doc_config["id"]
    width = doc_config.get("width", 800)
    height = doc_config.get("height", 900)

    img = create_parchment_background(width, height)
    draw = ImageDraw.Draw(img)

    header_font = get_serif_font(22, bold=True)
    sub_font = get_serif_font(13, bold=False)
    body_font = get_serif_font(15, bold=False)

    text_color = (25, 20, 18)
    line_color = (60, 45, 35)

    annotations = []
    full_text_words = []
    y_cursor = 45

    # 1. Header
    title = doc_config["title"]
    t_box = header_font.getbbox(title)
    t_w = t_box[2] - t_box[0]
    title_x = (width - t_w) // 2
    draw.text((title_x, y_cursor), title, font=header_font, fill=text_color)

    if include_header_footer:
        words = title.split()
        curr_x = title_x
        for i, w in enumerate(words):
            wb = header_font.getbbox(w)
            ww = wb[2] - wb[0]
            wh = wb[3] - wb[1]
            annotations.append({
                "image_id": image_id,
                "word_id": f"w_{len(annotations)}",
                "transcription": w,
                "x_min": int(curr_x),
                "y_min": int(y_cursor),
                "x_max": int(curr_x + ww),
                "y_max": int(y_cursor + wh + 4),
                "confidence": 1.0,
            })
            full_text_words.append(w)
            space_w = header_font.getbbox(" ")[2] - header_font.getbbox(" ")[0]
            curr_x += ww + space_w

    y_cursor += 36

    # 2. Subheader
    sub = doc_config.get("subtitle", "")
    if sub:
        s_box = sub_font.getbbox(sub)
        s_w = s_box[2] - s_box[0]
        sub_x = (width - s_w) // 2
        draw.text((sub_x, y_cursor), sub, font=sub_font, fill=(70, 60, 50))
        if include_header_footer:
            for w in sub.split():
                wb = sub_font.getbbox(w)
                ww = wb[2] - wb[0]
                wh = wb[3] - wb[1]
                annotations.append({
                    "image_id": image_id,
                    "word_id": f"w_{len(annotations)}",
                    "transcription": w,
                    "x_min": int(sub_x),
                    "y_min": int(y_cursor),
                    "x_max": int(sub_x + ww),
                    "y_max": int(y_cursor + wh + 3),
                    "confidence": 1.0,
                })
                full_text_words.append(w)
                space_w = sub_font.getbbox(" ")[2] - sub_font.getbbox(" ")[0]
                sub_x += ww + space_w
        y_cursor += 24

    draw.line([(40, y_cursor), (width - 40, y_cursor)], fill=line_color, width=2)
    draw.line([(40, y_cursor + 3), (width - 40, y_cursor + 3)], fill=line_color, width=1)
    y_cursor += 20

    # 3. Body paragraphs
    paragraphs = doc_config["paragraphs"]
    margin_x = 50
    max_line_w = width - (2 * margin_x)
    line_h = 24

    for p in paragraphs:
        p_words = p.split()
        curr_line = []
        curr_w = 0

        for w in p_words:
            wb = body_font.getbbox(w)
            ww = wb[2] - wb[0]
            space_w = body_font.getbbox(" ")[2] - body_font.getbbox(" ")[0]

            if curr_w + ww + space_w > max_line_w and curr_line:
                x_pos = margin_x
                for lw, lww, lwh in curr_line:
                    draw.text((x_pos, y_cursor), lw, font=body_font, fill=text_color)
                    annotations.append({
                        "image_id": image_id,
                        "word_id": f"w_{len(annotations)}",
                        "transcription": lw,
                        "x_min": int(x_pos),
                        "y_min": int(y_cursor),
                        "x_max": int(x_pos + lww),
                        "y_max": int(y_cursor + lwh + 4),
                        "confidence": 1.0,
                    })
                    full_text_words.append(lw)
                    x_pos += lww + space_w
                y_cursor += line_h
                curr_line = [(w, ww, wb[3] - wb[1])]
                curr_w = ww
            else:
                curr_line.append((w, ww, wb[3] - wb[1]))
                curr_w += ww + space_w

        if curr_line:
            x_pos = margin_x
            for lw, lww, lwh in curr_line:
                draw.text((x_pos, y_cursor), lw, font=body_font, fill=text_color)
                annotations.append({
                    "image_id": image_id,
                    "word_id": f"w_{len(annotations)}",
                    "transcription": lw,
                    "x_min": int(x_pos),
                    "y_min": int(y_cursor),
                    "x_max": int(x_pos + lww),
                    "y_max": int(y_cursor + lwh + 4),
                    "confidence": 1.0,
                })
                full_text_words.append(lw)
                space_w = body_font.getbbox(" ")[2] - body_font.getbbox(" ")[0]
                x_pos += lww + space_w
            y_cursor += line_h

        y_cursor += 12

    # Final footer rule and date
    y_cursor += 10
    draw.line([(60, y_cursor), (width - 60, y_cursor)], fill=line_color, width=1)
    y_cursor += 15
    footer_text = doc_config.get("footer", "De l'Imprimerie Nationale — Paris, 1789")
    ft_box = sub_font.getbbox(footer_text)
    ft_w = ft_box[2] - ft_box[0]
    ft_x = (width - ft_w) // 2
    draw.text((ft_x, y_cursor), footer_text, font=sub_font, fill=(90, 80, 70))
    if include_header_footer:
        for w in footer_text.split():
            wb = sub_font.getbbox(w)
            ww = wb[2] - wb[0]
            wh = wb[3] - wb[1]
            annotations.append({
                "image_id": image_id,
                "word_id": f"w_{len(annotations)}",
                "transcription": w,
                "x_min": int(ft_x),
                "y_min": int(y_cursor),
                "x_max": int(ft_x + ww),
                "y_max": int(y_cursor + wh + 3),
                "confidence": 1.0,
            })
            full_text_words.append(w)
            space_w = sub_font.getbbox(" ")[2] - sub_font.getbbox(" ")[0]
            ft_x += ww + space_w

    out_base = output_dir or REPO_ROOT / "data"
    img_dir = out_base / "raw" / "images"
    gt_dir = out_base / "ground_truth"
    annot_dir = out_base / "annotations"

    img_dir.mkdir(parents=True, exist_ok=True)
    gt_dir.mkdir(parents=True, exist_ok=True)
    annot_dir.mkdir(parents=True, exist_ok=True)

    img_path = img_dir / f"{image_id}.jpg"
    img.save(img_path, quality=95)

    gt_path = gt_dir / f"{image_id}.txt"
    gt_text = " ".join(full_text_words)
    gt_path.write_text(gt_text, encoding="utf-8")

    annot_path = annot_dir / f"{image_id}.json"
    annot_path.write_text(json.dumps(annotations, indent=2, ensure_ascii=False), encoding="utf-8")

    return img_path, gt_path, annot_path


def generate_synthetic_hard_dataset(
    output_base_dir: Optional[Path] = None,
    num_samples: int = 15,
) -> Dict[str, Any]:
    """
    Generates a dedicated 'synthetic_hard' benchmark dataset featuring severe
    degradations (rotation, curved cylindrical warp, heavy blur, multi-column layout,
    and script handwriting typography) designed to discriminate modern OCR models.
    """
    out_dir = output_base_dir or (REPO_ROOT / "data" / "raw" / "synthetic_hard")
    images_dir = out_dir / "images"
    gt_dir = out_dir / "ground_truth"
    annot_dir = out_dir / "annotations"

    images_dir.mkdir(parents=True, exist_ok=True)
    gt_dir.mkdir(parents=True, exist_ok=True)
    annot_dir.mkdir(parents=True, exist_ok=True)

    metadata_rows = []
    degradations = [
        "severe_rotation",
        "cylindrical_warp",
        "heavy_gaussian_blur",
        "script_handwriting",
        "multi_column_narrow",
    ]

    for idx in range(1, num_samples + 1):
        image_id = f"HARD_{idx:03d}"
        deg_type = degradations[(idx - 1) % len(degradations)]

        w, h = 1200, 1600
        canvas = create_parchment_background(w, h, aged_intensity=1.5)
        draw = ImageDraw.Draw(canvas)

        is_script = deg_type == "script_handwriting"
        h_font = get_serif_font(28, bold=True, script=is_script)
        b_font = get_serif_font(18, bold=False, script=is_script)

        header = f"HISTORICAL ARCHIVE DISPATCH — NO. {idx:03d}"
        body_paras = [
            "The resolution of municipal affairs in the district of Upper Cumberland was formally registered on the tenth of November.",
            "Inspectors observed substantial wear on the primary ledgers due to environmental moisture and historical coal smoke.",
            "All subsequent transcripts require verification by the archivist prior to binding into the regional record catalog.",
        ]
        footer = f"Document ID: {image_id}"

        words_annotations = []
        full_text_lines = []

        # Render Header
        draw.text((100, 80), header, font=h_font, fill=(30, 25, 20))
        full_text_lines.append(header)
        for w_item in header.split():
            words_annotations.append({
                "image_id": image_id,
                "word_id": f"w_1_{len(words_annotations)}",
                "transcription": w_item,
                "x_min": 100,
                "y_min": 80,
                "x_max": 200,
                "y_max": 120,
                "confidence": 1.0,
            })

        y_pos = 180
        if deg_type == "multi_column_narrow":
            col_w = 450
            for c_idx, col_x in enumerate([100, 620]):
                col_y = y_pos
                for line in [
                    f"Column {c_idx+1} paragraph detailing regional trade accounts and transactions.",
                    "Merchants noted variable supply lines throughout the winter months.",
                ]:
                    draw.text((col_x, col_y), line, font=b_font, fill=(35, 30, 25))
                    full_text_lines.append(line)
                    col_y += 40
        else:
            for p in body_paras:
                draw.text((100, y_pos), p, font=b_font, fill=(35, 30, 25))
                full_text_lines.append(p)
                y_pos += 60

        draw.text((100, 1480), footer, font=b_font, fill=(40, 35, 30))
        full_text_lines.append(footer)

        # Apply specific severe degradation transform
        if deg_type == "severe_rotation":
            canvas = canvas.rotate(8, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(240, 230, 215))
        elif deg_type == "heavy_gaussian_blur":
            canvas = canvas.filter(ImageFilter.GaussianBlur(radius=3.0))
        elif deg_type == "cylindrical_warp":
            canvas = canvas.transform(
                (w, h), Image.Transform.QUAD, (0, 30, 0, h - 30, w, h, w, 0), resample=Image.Resampling.BILINEAR
            )

        img_out_path = images_dir / f"{image_id}.png"
        canvas.save(img_out_path)

        gt_text = "\n".join(full_text_lines)
        (gt_dir / f"{image_id}.txt").write_text(gt_text, encoding="utf-8")
        (annot_dir / f"{image_id}.json").write_text(
            json.dumps(words_annotations, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        metadata_rows.append({
            "image_id": image_id,
            "document_type": "archive_record",
            "degradation_type": deg_type,
            "width": w,
            "height": h,
            "ground_truth_available": True,
        })

    meta_df = pd.DataFrame(metadata_rows)
    meta_df.to_csv(out_dir / "metadata.csv", index=False)
    logging.info(f"Generated {num_samples} synthetic_hard documents in {out_dir}")
    return {"count": num_samples, "directory": str(out_dir)}


DOCS = [
    {
        "id": "DEMO_HIST_01",
        "title": "GAZETTE NATIONALE DE FRANCE",
        "subtitle": "Numéro 14. — Mercredi 28 Juillet 1789. — Prix 3 sous.",
        "paragraphs": [
            "Décret relatif à la tranquillité publique et au maintien de l'ordre constitutionnel dans les provinces du royaume.",
            "L'Assemblée nationale, considérant que les premiers moments de la régénération politique de l'État exigent la vigilance la plus active, déclare que les officiers municipaux et la milice bourgeoise doivent veiller avec fermeté à la sûreté des personnes et des propriétés.",
            "Toute tentative de sédition ou d'atteinte aux décrets rendus par les représentants de la nation sera poursuivie avec la plus exacte sévérité des lois établies.",
        ],
        "footer": "À Paris, de l'Imprimerie des Députés, rue du Dauphin, No 24.",
    },
    {
        "id": "DEMO_HIST_02",
        "title": "RÉPUBLIQUE FRANÇAISE — ÉTAT CIVIL",
        "subtitle": "Extrait du Registre des Actes de l'an 1842 — Arrondissement de la Seine",
        "paragraphs": [
            "L'an mil huit cent quarante-deux, le quinze mars à dix heures du matin, par-devant nous soussigné officier de l'état civil de la ville de Paris, a comparu le sieur François Delatour, horloger demeurant rue Saint-Denis.",
            "Lequel nous a présenté un enfant du sexe masculin, né le jour précédent de son union légitime avec dame Marguerite Bernard, couturière, et auquel il a donné les prénoms de Charles Maxime.",
            "Lesdites déclarations et présentations faites en présence des sieurs Henri Moreau, typographe, et Pierre Lefèvre, libraire, témoins majeurs qui ont signé avec nous après lecture.",
        ],
        "footer": "Certifié conforme aux registres déposés aux Archives Départementales.",
    },
    {
        "id": "DEMO_HIST_03",
        "title": "JOURNAL DES SAVANTS — ÉDITION HISTORIQUE",
        "subtitle": "Tome III. — Mémoires d'Histoire et de Typographie Ancienne (1815)",
        "paragraphs": [
            "L'examen attentif des caractères mobiles anciens démontre que la typographie du dix-huitième siècle possédait une clarté remarquable.",
            "Les encres minérales appliquées sur papier chiffon conféraient aux feuillets une durabilité très supérieure à celle des procédés contemporains.",
            "La restitution automatique de ces textes par reconnaissance optique nécessite des modèles robustes aux déformations du parchemin et à l'altération séculaire des pigments d'impression.",
        ],
        "footer": "Publié sous les auspices de l'Académie Royale des Sciences.",
    },
]


def generate_all_synthetic_data():
    results = []
    for doc in DOCS:
        img_p, gt_p, an_p = render_synthetic_document(doc)
        results.append({"id": doc["id"], "img": str(img_p), "gt": str(gt_p), "annotations": str(an_p)})
    return results


if __name__ == "__main__":
    regenerate_synthetic_en_ground_truth(include_header_footer=True)
    generate_all_synthetic_data()
    generate_synthetic_hard_dataset()
    print("Synthetic dataset generation complete.")
