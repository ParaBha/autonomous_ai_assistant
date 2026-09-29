import fitz  # PyMuPDF
import docx
from pptx import Presentation
import pandas as pd
import os
import io
from app.core.config import settings

class IngestionService:
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        text = ""
        with fitz.open(file_path) as doc:
            for page in doc:
                text += page.get_text()
        return text

    @staticmethod
    def extract_text_from_docx(file_path: str) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

    @staticmethod
    def extract_text_from_pptx(file_path: str) -> str:
        prs = Presentation(file_path)
        text = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text.append(shape.text)
        return "\n".join(text)

    @staticmethod
    def extract_text_from_csv(file_path: str) -> str:
        df = pd.read_csv(file_path)
        return df.to_string()

    @staticmethod
    def extract_text_from_image(file_path: str) -> str:
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(file_path)
            return pytesseract.image_to_string(img)
        except ImportError:
            return "OCR error: PIL or pytesseract not installed."
        except Exception as e:
            return f"OCR error: {str(e)}. Please ensure Tesseract OCR is installed on the system."

    @classmethod
    def process_file(cls, file_path: str) -> str:
        ext = file_path.split(".")[-1].lower()
        if ext == "pdf":
            return cls.extract_text_from_pdf(file_path)
        elif ext == "docx":
            return cls.extract_text_from_docx(file_path)
        elif ext == "pptx":
            return cls.extract_text_from_pptx(file_path)
        elif ext == "csv":
            return cls.extract_text_from_csv(file_path)
        elif ext in ["png", "jpg", "jpeg"]:
            return cls.extract_text_from_image(file_path)
        elif ext in ["txt", "md"]:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file extension: {ext}")

ingestion_service = IngestionService()
