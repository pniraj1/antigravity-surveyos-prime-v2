
import sys
import os

try:
    import pypdf
    print("pypdf found")
except ImportError:
    try:
        import PyPDF2 as pypdf
        print("PyPDF2 found")
    except ImportError:
        print("No PDF library found")
        sys.exit(1)

pdf_path = r"c:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2\total loss report sample.pdf"
output_path = r"c:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2\total_loss_text.txt"

if not os.path.exists(pdf_path):
    print(f"File not found: {pdf_path}")
    sys.exit(1)

reader = pypdf.PdfReader(pdf_path)
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open(output_path, "w", encoding="utf-8") as f:
    f.write(text)
print(f"Successfully extracted text to {output_path}")
