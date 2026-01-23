
const PDFDocument = require('pdfkit');
const fontkit = require('fontkit');
const fs = require('fs');

const fontPath = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';

try {
  console.log(`Testing font: ${fontPath}`);
  if (!fs.existsSync(fontPath)) {
    console.error('File does not exist!');
    process.exit(1);
  }
  
  const doc = new PDFDocument();
  doc.registerFont('Chinese', fontPath);
  doc.font('Chinese');
  doc.text('你好 world');
  console.log('Success!');
} catch (e) {
  console.error('Failed:', e);
}
