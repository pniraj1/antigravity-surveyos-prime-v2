const fs = require('fs');
const pdf = require('pdf-parse');

async function extractPdf(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return;
    }
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    console.log(`\n\n=== EXTRACTED: ${filePath} ===`);
    console.log(data.text); 
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
}

(async () => {
    await extractPdf("C:\\Users\\Manasi\\Downloads\\Bill Check  MOTOR8112026 Dzire VXI  23.BH.2812J.pdf");
    await extractPdf("C:\\Users\\Manasi\\Downloads\\FInal Report MOTOR8112026Dzire VXI.pdf");
})();
