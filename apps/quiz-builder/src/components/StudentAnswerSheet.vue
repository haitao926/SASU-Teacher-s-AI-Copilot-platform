<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import QRCode from 'qrcode'
import type { Student } from './StudentSelector.vue'

const props = defineProps<{
  student: Student
  layout: any
}>()

const rootRef = ref<HTMLDivElement | null>(null)
const qrCanvas = ref<HTMLCanvasElement | null>(null)

// Expose the layout measurement function
defineExpose({
  getLayoutData
})

async function generateQR() {
  if (qrCanvas.value && props.student.studentId) {
    try {
      await QRCode.toCanvas(qrCanvas.value, props.student.studentId, {
        width: 80,
        margin: 0,
        color: {
            dark: '#000000',
            light: '#ffffff00' // transparent background
        }
      })
    } catch (e) {
      console.error(e)
    }
  }
}

// Measure and return layout geometry
function getLayoutData() {
  if (!rootRef.value) return null
  
  const rootRect = rootRef.value.getBoundingClientRect()
  const zones: any[] = []

  // Helper to get relative coords
  const getRelRect = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return {
      x: r.left - rootRect.left,
      y: r.top - rootRect.top,
      w: r.width,
      h: r.height
    }
  }

  // Find QR code position first (Anchor)
  let qrRect = { x: 0, y: 0, w: 0, h: 0 }
  if (qrCanvas.value) {
    qrRect = getRelRect(qrCanvas.value)
    zones.push({
      type: 'anchor',
      name: 'qrcode',
      rect: qrRect
    })
  }

  // Helper to get coords relative to QR Anchor (Top-Left)
  const getAnchorRelRect = (el: HTMLElement) => {
    const rel = getRelRect(el)
    return {
      x: rel.x - qrRect.x,
      y: rel.y - qrRect.y,
      w: rel.w,
      h: rel.h
    }
  }

  // Find choice/judge bubbles (NOW they are Write-in areas, but we still track them as zones)
  const writeInItems = rootRef.value.querySelectorAll('.write-in-area')
  writeInItems.forEach((el) => {
    const qNum = el.getAttribute('data-q-num')
    if (qNum) {
      zones.push({
        qNum: parseInt(qNum),
        type: 'rect', // Changed from bubble to rect as it is handwriting area
        rect: getAnchorRelRect(el as HTMLElement)
      })
    }
  })

  // Find fill-in-blank lines
  const blankLines = rootRef.value.querySelectorAll('.blank-line')
  blankLines.forEach((el) => {
    const qNum = el.getAttribute('data-q-num')
    if (qNum) {
      zones.push({
        qNum: parseInt(qNum),
        type: 'rect',
        rect: getAnchorRelRect(el as HTMLElement)
      })
    }
  })

  // Find comprehensive/mixed/short-answer boxes
  const compBoxes = rootRef.value.querySelectorAll('.comprehensive-box')
  compBoxes.forEach((el) => {
    const qNum = el.getAttribute('data-q-num')
    if (qNum) {
      zones.push({
        qNum: parseInt(qNum),
        type: 'rect', // Treat as a large rect area for recognition/segmentation
        rect: getAnchorRelRect(el as HTMLElement)
      })
    }
  })

  // Find calculation boxes
  const calcBoxes = rootRef.value.querySelectorAll('.calc-box')
  calcBoxes.forEach((el) => {
    const qNum = el.getAttribute('data-q-num')
    if (qNum) {
      zones.push({
        qNum: parseInt(qNum),
        type: 'rect',
        rect: getAnchorRelRect(el as HTMLElement)
      })
    }
  })

  // Find essay box
  const essayBoxes = rootRef.value.querySelectorAll('.essay-box')
  essayBoxes.forEach((el, idx) => {
    const sectionTitle = el.closest('.section')?.querySelector('.section-title')?.textContent
    zones.push({
      type: 'essay',
      label: sectionTitle,
      rect: getAnchorRelRect(el as HTMLElement)
    })
  })

  return {
    width: rootRect.width,
    height: rootRect.height,
    anchor: 'qrcode-top-left',
    zones
  }
}

// Helper to chunk questions into groups of 5
function chunkQuestions(count: number, size = 5) {
  const chunks = []
  for (let i = 0; i < count; i += size) {
    chunks.push({
      start: i + 1,
      end: Math.min(i + size, count),
      items: Array.from({ length: Math.min(size, count - i) }, (_, k) => i + k + 1)
    })
  }
  return chunks
}

watch(() => props.student.id, generateQR)
onMounted(generateQR)
</script>

<template>
  <div ref="rootRef" class="answer-sheet" :class="layout.paperSize">
    <!-- Header -->
    <div class="header">
      <div class="info">
        <h1 class="title">{{ layout.title }}</h1>
        <div class="meta">
          <span>班级: <u>{{ student.class }}</u></span>
          <span>姓名: <u>{{ student.name }}</u></span>
          <span>考号: <u>{{ student.studentId }}</u></span>
        </div>
      </div>
      <div class="qr-container">
        <canvas ref="qrCanvas"></canvas>
        <div class="qr-label">Student ID</div>
      </div>
    </div>

    <!-- Instructions / Warning -->
    <div class="instructions">
      注意事项：1. 请在指定区域内作答，超出黑色边框区域无效。 2. 选择题和判断题请在对应题号下方的方框内填写答案。
    </div>

    <!-- Sections -->
    <div class="sections">
      <div v-for="(section, idx) in layout.sections" :key="section.id" class="section">
        <h3 class="section-title">{{ ['一','二','三','四','五','六'][idx] }}、{{ section.title }}</h3>
        
        <!-- Optional Question Content -->
        <div v-if="section.content" class="question-content">
          {{ section.content }}
        </div>
        
        <!-- Choice / Judge (Write-in Table Style) -->
        <div v-if="section.type === 'choice' || section.type === 'judge'" class="omr-table-container">
          <div v-for="(chunk, cIdx) in chunkQuestions(section.count, 5)" :key="cIdx" class="omr-group">
            <!-- Row 1: Question Numbers -->
             <div class="omr-row header-row">
               <div v-for="qNum in chunk.items" :key="qNum" class="omr-cell q-num-cell">
                 {{ qNum }}
               </div>
             </div>
            <!-- Row 2: Answer Write-in Area -->
             <div class="omr-row options-row">
               <div v-for="qNum in chunk.items" :key="qNum" class="omr-cell options-cell">
                  <div 
                    class="write-in-area"
                    :data-q-num="qNum"
                  >
                    <!-- Empty box for student to write A/B/C/D or T/F -->
                  </div>
               </div>
             </div>
          </div>
        </div>

        <!-- Blank / Text (Reverted to Lines) -->
        <div v-else-if="section.type === 'blank'" class="blank-grid">
           <div v-for="n in section.count" :key="n" class="blank-item">
             <span class="q-num">{{ n }}.</span>
             <div 
               class="blank-line"
               :data-q-num="n"
             ></div>
           </div>
        </div>

        <!-- Calculation (Grid for elementary math) -->
        <div v-else-if="section.type === 'calculation'" class="calc-grid">
           <div v-for="n in section.count" :key="n" class="calc-item">
             <div class="calc-label">{{ n }}.</div>
             <div class="calc-box" :data-q-num="n">
                <!-- Large white box for showing work -->
             </div>
           </div>
        </div>

        <!-- Short Answer (Ruled Lines) -->
        <div v-else-if="section.type === 'short-answer'" class="comp-grid">
           <div v-for="n in section.count" :key="n" class="comp-item">
             <div class="comp-label">{{ n }}.</div>
             <div class="ruled-area comprehensive-box" :data-q-num="n">
               <!-- Generate rules lines based on config, default 5 -->
               <div v-for="line in (section.lines || 5)" :key="line" class="rule-line"></div>
             </div>
           </div>
        </div>

        <!-- Comprehensive / Mixed (Box) -->
        <div v-else-if="section.type === 'comprehensive'" class="comp-grid">
           <div v-for="n in section.count" :key="n" class="comp-item">
             <div class="comp-label">{{ n }}.</div>
             <div class="comprehensive-box" :data-q-num="n" :style="{ height: (section.lines ? section.lines * 30 : 120) + 'px' }">
               <!-- Blank box, height configurable -->
             </div>
           </div>
        </div>

        <!-- Essay -->
        <div v-else-if="section.type === 'essay'" class="essay-grid">
           <div class="essay-box">
             <!-- 15 rows approx for standard -->
             <div v-for="r in 15" :key="r" class="essay-row"></div>
             <div class="essay-count">600 字</div>
           </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sheet Layout */
.answer-sheet {
  width: 210mm;
  min-height: 297mm;
  padding: 10mm;
  background: white;
  position: relative;
  box-sizing: border-box;
  margin: 0 auto;
  color: #000;
  font-family: "SimSun", serif;
}
.answer-sheet.A3 { width: 297mm; min-height: 420mm; }

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #000;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
.info { flex: 1; text-align: center; }
.title { font-size: 22px; font-weight: bold; margin: 0 0 15px 0; }
.meta { 
    display: flex; 
    justify-content: center; 
    gap: 20px; 
    font-size: 16px; 
}
.meta u { 
    min-width: 80px; 
    display: inline-block; 
    text-align: center; 
    text-decoration: none; 
    border-bottom: 1px solid #000; 
    font-weight: bold;
}

.qr-container { width: 80px; text-align: center; }
.qr-label { font-size: 10px; margin-top: -5px; }
canvas { width: 80px !important; height: 80px !important; }

.instructions {
  border: 1px solid #000;
  padding: 5px 10px;
  font-size: 12px;
  margin-bottom: 15px;
  background: #f0f0f0;
  -webkit-print-color-adjust: exact;
}

/* Sections */
.section { margin-bottom: 15px; }

/* Question Content Text */
.question-content {
  margin-bottom: 10px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap; /* Preserve newlines */
}

/* UPDATED SECTION TITLE STYLE: Left Border Pill */
.section-title { 
    font-size: 16px; 
    font-weight: bold; 
    margin: 0 0 10px 0; 
    color: #000; 
    border-left: 5px solid #000;
    padding-left: 8px;
    background: #f4f4f5;
    padding-top: 4px;
    padding-bottom: 4px;
    -webkit-print-color-adjust: exact;
}

/* OMR Table Style (Choice/Judge) */
.omr-table-container {
  display: flex;
  flex-wrap: wrap;
  gap: 15px; /* Gap between groups of 5 */
}

.omr-group {
  border: 1px solid #d11e1e; /* Standard Red Color for OMR */
  display: flex;
  flex-direction: column;
  -webkit-print-color-adjust: exact;
  page-break-inside: avoid;
}

.omr-row {
  display: flex;
}

.omr-cell {
  width: 32px; /* Fixed width for cells */
  border-right: 1px solid #d11e1e;
  display: flex;
  justify-content: center;
  align-items: center;
}
.omr-cell:last-child { border-right: none; }

.q-num-cell {
  height: 24px;
  background-color: #fce8e8; /* Light red bg for header */
  font-weight: bold;
  color: #d11e1e;
  border-bottom: 1px solid #d11e1e;
  -webkit-print-color-adjust: exact;
}

.options-cell {
  padding: 0; 
  background-color: #fff;
  height: 40px;
}

.write-in-area {
  width: 100%;
  height: 100%;
}

/* Blank (Reverted to Line) */
.blank-grid { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 10px; }
.blank-item { width: 48%; display: flex; align-items: end; margin-bottom: 15px; page-break-inside: avoid; }
.blank-line { 
    border-bottom: 1px solid #000; 
    flex: 1; 
    margin-left: 5px; 
    height: 24px; /* Space for writing above line */
}

/* Calculation Grid */
.calc-grid { display: flex; flex-wrap: wrap; gap: 15px; }
.calc-item { width: 48%; margin-bottom: 15px; page-break-inside: avoid; }
.calc-label { font-weight: bold; margin-bottom: 4px; font-size: 14px; }
.calc-box {
  width: 100%;
  height: 150px; /* Suitable for vertical math */
  border: 1px solid #000;
}

/* Comprehensive */
.comp-grid { display: flex; flex-direction: column; gap: 10px; }
.comp-item { display: flex; flex-direction: column; page-break-inside: avoid; }
.comp-label { font-weight: bold; margin-bottom: 4px; font-size: 14px; }
.comprehensive-box {
  width: 100%;
  /* height set inline */
  border: 1px solid #000;
}

/* Ruled Area (Short Answer) */
.ruled-area {
  width: 100%;
  border: 1px solid #000;
}
.rule-line {
  height: 30px;
  border-bottom: 1px dashed #ccc;
  width: 100%;
}
.rule-line:last-child { border-bottom: none; }

/* Essay */
.essay-box { 
    border: 1px solid #d11e1e; 
    padding: 2px; 
    -webkit-print-color-adjust: exact;
    margin-top: 10px;
    page-break-inside: avoid; 
}
.essay-row { 
  height: 35px; 
  border-bottom: 1px solid #fababb; 
  background-image: linear-gradient(90deg, transparent 34px, #fababb 35px);
  background-size: 35px 100%;
  -webkit-print-color-adjust: exact;
}
.essay-count { text-align: right; font-size: 10px; margin-top: 4px; color: #666; }
</style>
