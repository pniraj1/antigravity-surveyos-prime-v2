const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/Manasi/.gemini/antigravity/brain/e91d6360-2d0f-407c-b078-f854a20ad90b/.system_generated/steps/2261/output.txt', 'utf8'));

console.log(`Total documents: ${data.documents.length}`);

data.documents.forEach((doc, index) => {
  const size = Buffer.byteLength(JSON.stringify(doc), 'utf8');
  let name = "Unknown";
  if (doc.fields && doc.fields.id && doc.fields.id.stringValue) {
    name = doc.fields.id.stringValue;
  }
  
  // Also check if there's a photos array
  let photosCount = 0;
  if (doc.fields && doc.fields.photos && doc.fields.photos.arrayValue && doc.fields.photos.arrayValue.values) {
    photosCount = doc.fields.photos.arrayValue.values.length;
  }
  
  console.log(`Claim ${index + 1}: ID = ${name}, Size = ${(size / 1024).toFixed(2)} KB, Photos = ${photosCount}`);
});
