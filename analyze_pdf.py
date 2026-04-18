import fitz  # PyMuPDF
import sys

def analyze_pdf(path):
    print(f"--- Analyzing {path} ---")
    try:
        doc = fitz.open(path)
        print(f"Pages: {len(doc)}")
        for i in range(len(doc)):
            page = doc[i]
            images = page.get_images(full=True)
            for j, img in enumerate(images):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]
                width = base_image["width"]
                height = base_image["height"]
                print(f"Page {i+1}, Img {j+1}: {width}x{height}, {len(image_bytes)/1024:.2f} KB, format: {ext}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    analyze_pdf(r"C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2\photosheetsforreview_extracted\SAMPLE PHOTOSHEET SWAR.pdf")
    analyze_pdf(r"C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2\photosheetsforreview_extracted\SURVEY OS PHOTOSHEET.pdf")
