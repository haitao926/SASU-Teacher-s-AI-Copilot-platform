const Tesseract = require('tesseract.js');
const path = require('path');

async function recognize() {
  const imagePath = path.resolve(process.cwd(), '../image.png');
  console.log(`Analyzing image: ${imagePath}`);
  
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'chi_sim+eng', {
      logger: m => {
        if (m.status === 'recognizing text' && (m.progress * 100) % 20 === 0) {
          console.log(`Progress: ${Math.floor(m.progress * 100)}%`);
        }
      }
    });
    console.log('\n--- OCR Result ---');
    console.log(text);
    console.log('------------------');
  } catch (error) {
    console.error('Error recognizing image:', error);
  }
}

recognize();
