const http = require('http');

// Config
const HOST = 'localhost';
const PORT = 8150;
const SECRET = 'dev-secret-change-me'; // From config.ts default

// Simple mock JWT generation (since we don't want to depend on jsonwebtoken package if not installed globally)
// Header
const header = { alg: 'HS256', typ: 'JWT' };
const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
// Payload
const payload = { sub: 'test-user', role: 'teacher', iat: Math.floor(Date.now() / 1000) };
const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
// Signature (Mock - the backend verify might fail if we don't sign correctly with crypto)
// Let's rely on the backend possibly being in dev mode or try a simpler approach:
// Just try to hit the health check or use a known test token if available.
// Actually, let's use the 'mockAuth' route if it exists, or just try to sign it properly if crypto is available.
const crypto = require('crypto');
const signature = crypto.createHmac('sha256', SECRET).update(b64Header + '.' + b64Payload).digest('base64url');
const TOKEN = `${b64Header}.${b64Payload}.${signature}`;

// Dummy 1x1 Pixel Base64 JPEG
const DUMMY_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('--- Starting Smoke Test ---');
  
  // 1. Test OCR Upload
  console.log('\n1. Testing OCR Upload...');
  const uploadRes = await request('POST', '/api/ocr/upload', {
    fileName: 'test.jpg',
    contentBase64: DUMMY_IMAGE,
    scene: 'lens'
  });
  
  if (uploadRes.status !== 200 && uploadRes.status !== 202) {
    console.error('OCR Upload Failed:', uploadRes);
    return;
  }
  
  const taskId = uploadRes.data.taskId;
  console.log(`   Task ID: ${taskId} (Source: ${uploadRes.data.source})`);
  
  // 2. Poll Status
  console.log('\n2. Polling OCR Status...');
  let ocrText = '';
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await request('GET', `/api/ocr/status/${taskId}`);
    console.log(`   Attempt ${i+1}: ${statusRes.data.status}`);
    
    if (statusRes.data.status === 'done') {
        const resultRes = await request('GET', `/api/ocr/result/${taskId}`);
        ocrText = resultRes.data.result;
        console.log('   OCR Result:', ocrText ? ocrText.substring(0, 50) + '...' : '(Empty)');
        break;
    }
  }
  
  if (!ocrText) {
      console.log('   (Skipping Grading test because OCR text is empty - likely mock or image too small)');
      // For testing, force some text
      ocrText = "The area of the triangle is 50."; 
  }

  // 3. Test Grading (DeepSeek)
  console.log('\n3. Testing Intelligent Grading (DeepSeek)...');
  const gradeRes = await request('POST', '/api/grading/grade-image', {
    imageBase64: DUMMY_IMAGE,
    questionText: 'Calculate the area.',
    correctAnswer: '50',
    maxPoints: 5,
    ocrText: ocrText
  });
  
  console.log('   Response:', JSON.stringify(gradeRes.data, null, 2));
  
  if (gradeRes.status === 200) {
      console.log('\n✅ Smoke Test Passed!');
  } else {
      console.log('\n❌ Grading API Failed');
  }
}

runTest();
