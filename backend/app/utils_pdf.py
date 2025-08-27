import numpy as np
import pypdfium2 as pdfium
import cv2
def pdf_page_count(path: str) -> int:
    pdf = pdfium.PdfDocument(path); n=len(pdf); pdf.close(); return n
def render_pdf_page_to_image_bytes(path: str, page_index: int, scale: float = 2.0) -> bytes:
    pdf = pdfium.PdfDocument(path); page=pdf.get_page(page_index)
    bitmap = page.render(scale=scale).to_numpy(); page.close(); pdf.close()
    bgr = bitmap[..., :3][:, :, ::-1]; ok, buf = cv2.imencode(".png", bgr)
    return buf.tobytes() if ok else b""
def render_pdf_to_image_arrays(path: str, scale: float = 2.0):
    pdf = pdfium.PdfDocument(path); out=[]
    for i in range(len(pdf)):
        page=pdf.get_page(i); bitmap=page.render(scale=scale).to_numpy(); page.close()
        bgr = bitmap[..., :3][:, :, ::-1]; out.append(bgr)
    pdf.close(); return out


# Alias: keep backward-compat with main.py imports
def render_pdf_to_image_bytes(path: str, page_index: int, scale: float = 2.0) -> bytes:
    return render_pdf_page_to_image_bytes(path, page_index, scale=scale)
