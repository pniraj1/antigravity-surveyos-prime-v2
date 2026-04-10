# Surveyor User Manual
*Welcome to SurveyOS Prime V2.*

## 🌟 What is SurveyOS?
SurveyOS is a lightning-fast, offline-capable application designed specifically for Insurance Surveyors. It allows you to enter claim data, calculate assessments, generate fee bills, and instantly create pixel-perfect PDF or Excel reports (like UIIC format)—all without needing an active internet connection.

Think of it as your digital clipboard that never loses your data. 

---

## 🚀 Getting Started

### 1. The [[Dashboard]] (Your Mission Control)
When you open SurveyOS, you are greeted by the **Dashboard**. This is where all your local claims live. 
*   **Active Claims:** Shows all surveys you are currently working on.
*   **Archived Claims:** Shows old claims you have marked as 'Completed', getting them out of your way.
You don't need to manually save claims on your computer. They are stored safely inside the browser's local memory automatically!

### 2. Setting Up Your Profile
Before creating reports, make sure your surveyor profile is setup (usually under settings/profile tab). Your **Name**, **SLA Number**, and your **License Details** will be automatically injected into every report. This also powers our automatic [[Sequential_Numbering]], so you never have to guess what Report Number comes next.

---

## 📝 Creating a Claim

Follow the [[Claim_Lifecycle_Workflow]] for a deep dive, but the basics are:

1.  **Click "New Claim"**: From the [[Dashboard]], hit the big New Claim button.
2.  **Choose Survey Type**: Select **Spot** or **Final**. The system will auto-allocate a report number (e.g., `SPO/2026/014`).
3.  **Enter Details**: Navigate through the top tabs:
    *   **Details & Policy**: Vehicle registration, Insurer, and Policy specifics.
    *   **Assessment**: Add parts (Metal, Plastic, Glass, Labour, Paint). The engine does the math for depreciation and totals instantly!
    *   **Photos**: Upload your pictures.
    *   **Fee Bill**: Generate your professional invoice.

---

## 🖨️ Generating Reports

SurveyOS gives you two ways to output your hard work. Detailed logic for how this works is in the [[Reporting_Engine]] documentation.

1.  **Power Print (PDF)**: Click the Print button to generate a beautiful, standardized HTML report that you can "Save as PDF" instantly.
2.  **Excel Bridge (UIIC)**: If you selected UIIC as the insurer, an "Export UIIC Excel" button will appear. Clicking it instantly downloads a perfectly formatted `.xlsx` file designed for their exact requirements.

---

## 🔒 Safety and Archiving
Because SurveyOS uses our robust [[IndexedDB_Schema]], everything is saved the millisecond you type it. If your computer crashes, or you lose Wi-Fi, no problem. Just open the app again, go to the [[Dashboard]], and your active claim will be waiting for you.

When a claim is totally finalized, click the **Archive** icon (the small box icon on the far right of the claim row). It will hide the claim from your active list to keep your workspace clean!
