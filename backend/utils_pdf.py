import fitz
import numpy as np

def render_pdf_page_to_bgr(path: str, page: int = 1, dpi: int = 300):
    if page < 1:
        page = 1
    with fitz.open(path) as doc:
        if page > len(doc):
            page = len(doc)
        p = doc.load_page(page - 1)
        mat = fitz.Matrix(dpi/72.0, dpi/72.0)
        pix = p.get_pixmap(matrix=mat, alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        # RGB -> BGR
        return img[:, :, ::-1].copy(), len(doc), page
