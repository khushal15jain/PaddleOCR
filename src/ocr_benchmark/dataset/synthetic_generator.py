import json
import os
import random
from pathlib import Path
from typing import List, Dict, Any, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
IMAGES_DIR = REPO_ROOT / "data" / "raw" / "images"
GT_DIR = REPO_ROOT / "data" / "ground_truth"
ANNOTATIONS_DIR = REPO_ROOT / "data" / "annotations"


def create_parchment_background(width: int, height: int) -> Image.Image:
    """Create a realistic aged historical paper texture with patina and subtle grain."""
    # Base sepia / aged paper color
    base = Image.new("RGB", (width, height), (244, 237, 222))
    draw = ImageDraw.Draw(base)

    # Add gentle aged discoloration patches
    random.seed(42)
    for _ in range(120):
        cx = random.randint(0, width)
        cy = random.randint(0, height)
        radius = random.randint(20, 150)
        shade = random.randint(220, 240)
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(shade, shade - 8, shade - 20, 15))

    # Add subtle aged borders
    draw.rectangle([15, 15, width - 15, height - 15], outline=(180, 165, 140), width=2)
    draw.rectangle([20, 20, width - 20, height - 20], outline=(200, 185, 160), width=1)

    # Blur gently for organic paper look
    base = base.filter(ImageFilter.GaussianBlur(radius=0.5))
    return base


def get_serif_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
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


def render_synthetic_document(doc_config: Dict[str, Any]) -> Tuple[Path, Path, Path]:
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

    # Header word boxes
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
            "confidence": 1.0
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
                "confidence": 1.0
            })
            full_text_words.append(w)
            space_w = sub_font.getbbox(" ")[2] - sub_font.getbbox(" ")[0]
            sub_x += ww + space_w
        y_cursor += 24

    # Decorative separator rule
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
                # Render curr_line
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
                        "confidence": 1.0
                    })
                    full_text_words.append(lw)
                    x_pos += lww + space_w
                y_cursor += line_h
                curr_line = [(w, ww, wb[3] - wb[1])]
                curr_w = ww
            else:
                curr_line.append((w, ww, wb[3] - wb[1]))
                curr_w += ww + space_w

        # Render trailing line
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
                    "confidence": 1.0
                })
                full_text_words.append(lw)
                space_w = body_font.getbbox(" ")[2] - body_font.getbbox(" ")[0]
                x_pos += lww + space_w
            y_cursor += line_h

        y_cursor += 12  # Paragraph gap

    # Final footer rule and date
    y_cursor += 10
    draw.line([(60, y_cursor), (width - 60, y_cursor)], fill=line_color, width=1)
    y_cursor += 15
    footer_text = doc_config.get("footer", "De l'Imprimerie Nationale — Paris, 1789")
    ft_box = sub_font.getbbox(footer_text)
    ft_w = ft_box[2] - ft_box[0]
    ft_x = (width - ft_w) // 2
    draw.text((ft_x, y_cursor), footer_text, font=sub_font, fill=(90, 80, 70))
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
            "confidence": 1.0
        })
        full_text_words.append(w)
        space_w = sub_font.getbbox(" ")[2] - sub_font.getbbox(" ")[0]
        ft_x += ww + space_w

    # Ensure output directories exist
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    GT_DIR.mkdir(parents=True, exist_ok=True)
    ANNOTATIONS_DIR.mkdir(parents=True, exist_ok=True)

    img_path = IMAGES_DIR / f"{image_id}.jpg"
    img.save(img_path, quality=95)

    gt_path = GT_DIR / f"{image_id}.txt"
    gt_text = " ".join(full_text_words)
    gt_path.write_text(gt_text, encoding="utf-8")

    annot_path = ANNOTATIONS_DIR / f"{image_id}.json"
    annot_path.write_text(json.dumps(annotations, indent=2, ensure_ascii=False), encoding="utf-8")

    return img_path, gt_path, annot_path


DOCS = [
    {
        "id": "DEMO_HIST_01",
        "title": "GAZETTE NATIONALE DE FRANCE",
        "subtitle": "Numéro 14. — Mercredi 28 Juillet 1789. — Prix 3 sous.",
        "paragraphs": [
            "Décret relatif à la tranquillité publique et au maintien de l'ordre constitutionnel dans les provinces du royaume.",
            "L'Assemblée nationale, considérant que les premiers moments de la régénération politique de l'État exigent la vigilance la plus active, déclare que les officiers municipaux et la milice bourgeoise doivent veiller avec fermeté à la sûreté des personnes et des propriétés.",
            "Toute tentative de sédition ou d'atteinte aux décrets rendus par les représentants de la nation sera poursuivie avec la plus exacte sévérité des lois établies."
        ],
        "footer": "À Paris, de l'Imprimerie des Députés, rue du Dauphin, No 24."
    },
    {
        "id": "DEMO_HIST_02",
        "title": "RÉPUBLIQUE FRANÇAISE — ÉTAT CIVIL",
        "subtitle": "Extrait du Registre des Actes de l'an 1842 — Arrondissement de la Seine",
        "paragraphs": [
            "L'an mil huit cent quarante-deux, le quinze mars à dix heures du matin, par-devant nous soussigné officier de l'état civil de la ville de Paris, a comparu le sieur François Delatour, horloger demeurant rue Saint-Denis.",
            "Lequel nous a présenté un enfant du sexe masculin, né le jour précédent de son union légitime avec dame Marguerite Bernard, couturière, et auquel il a donné les prénoms de Charles Maxime.",
            "Lesdites déclarations et présentations faites en présence des sieurs Henri Moreau, typographe, et Pierre Lefèvre, libraire, témoins majeurs qui ont signé avec nous après lecture."
        ],
        "footer": "Certifié conforme aux registres déposés aux Archives Départementales."
    },
    {
        "id": "DEMO_HIST_03",
        "title": "JOURNAL DES SAVANTS — ÉDITION HISTORIQUE",
        "subtitle": "Tome III. — Mémoires d'Histoire et de Typographie Ancienne (1815)",
        "paragraphs": [
            "L'examen attentif des caractères mobiles anciens démontre que la typographie du dix-huitième siècle possédait une clarté remarquable.",
            "Les encres minérales appliquées sur papier chiffon conféraient aux feuillets une durabilité très supérieure à celle des procédés contemporains.",
            "La restitution automatique de ces textes par reconnaissance optique nécessite des modèles robustes aux déformations du parchemin et à l'altération séculaire des pigments d'impression."
        ],
        "footer": "Publié sous les auspices de l'Académie Royale des Sciences."
    }
]


def generate_all_synthetic_data():
    results = []
    for doc in DOCS:
        img_p, gt_p, an_p = render_synthetic_document(doc)
        results.append({"id": doc["id"], "img": str(img_p), "gt": str(gt_p), "annotations": str(an_p)})
    return results


if __name__ == "__main__":
    generated = generate_all_synthetic_data()
    print(f"Generated {len(generated)} synthetic demonstration documents.")
