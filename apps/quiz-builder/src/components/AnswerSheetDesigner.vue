<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'
import StudentSelector, { type Student } from './StudentSelector.vue'
import StudentAnswerSheet from './StudentAnswerSheet.vue'

const token = useStorage('iai-token', '')
const tenantId = useStorage('iai-tenant', 'default')
// Remove /quizzes if present to get base API url
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes').replace('/quizzes', '')

const layout = ref({
  title: '期中考试答题卡',
  paperSize: 'A4',
  sections: [
    { id: 's1', type: 'choice', title: '选择题', count: 10, options: 4, content: '' },
    { id: 's2', type: 'blank', title: '填空题', count: 5, content: '' },
    { id: 's3', type: 'comprehensive', title: '综合题', count: 2, content: '' },
    { id: 's4', type: 'essay', title: '作文', count: 1, content: '' }
  ]
})

const selectedStudents = ref<Student[]>([])
const activeTab = ref<'design' | 'print'>('design')
const previewSheetRef = ref<any>(null)
const isSaving = ref(false)
const saveMessage = ref('')
const showStudentModal = ref(false)

// Modal state
const showModal = ref(false)
const modalForm = reactive({
  id: '',
  type: 'choice',
  title: '',
  count: 5,
  options: 4,
  content: '',
  lines: 5
})
const isEditing = ref(false)

// Maps type to icon
const typeIcons: Record<string, string> = {
    choice: 'mdi:checkbox-marked-circle-outline',
    judge: 'mdi:check-circle-outline',
    blank: 'mdi:form-textbox',
    calculation: 'mdi:calculator-variant-outline',
    comprehensive: 'mdi:text-box-outline',
    'short-answer': 'mdi:format-list-text', 
    essay: 'mdi:file-document-edit-outline'
}
const typeLabels: Record<string, string> = { 
    choice: '选择题', judge: '判断题', blank: '填空题', essay: '作文', comprehensive: '综合题', 'short-answer': '简答题', calculation: '计算题'
}

function openAddModal(type: string) {
  isEditing.value = false
  modalForm.id = ''
  modalForm.type = type
  modalForm.title = typeLabels[type]
  modalForm.count = (type === 'comprehensive' || type === 'essay') ? 1 : 5
  modalForm.options = 4
  modalForm.content = ''
  modalForm.lines = 5
  showModal.value = true
}

function openEditModal(section: any, idx: number) {
  isEditing.value = true
  modalForm.id = section.id
  modalForm.type = section.type
  modalForm.title = section.title
  modalForm.count = section.count
  modalForm.options = section.options || 4
  modalForm.content = section.content || ''
  modalForm.lines = section.lines || 5
  showModal.value = true
}

function confirmModal() {
  if (isEditing.value) {
    const idx = layout.value.sections.findIndex(s => s.id === modalForm.id)
    if (idx !== -1) {
      layout.value.sections[idx] = {
        ...layout.value.sections[idx],
        title: modalForm.title,
        count: modalForm.count,
        options: modalForm.options,
        content: modalForm.content,
        lines: modalForm.lines
      }
    }
  } else {
    layout.value.sections.push({
      id: Date.now().toString(),
      type: modalForm.type,
      title: modalForm.title,
      count: modalForm.count,
      options: modalForm.options,
      content: modalForm.content,
      lines: modalForm.lines
    })
  }
  showModal.value = false
}

function removeSection(idx: number) {
  if (confirm('确定删除此区域吗？')) {
    layout.value.sections.splice(idx, 1)
  }
}

function print() {
  window.print()
}

async function saveLayout() {
  if (!token.value) {
    alert('请先登录后操作')
    return
  }
  if (previewSheetRef.value) {
    const data = previewSheetRef.value.getLayoutData()
    if (!data) return
    
    isSaving.value = true
    saveMessage.value = ''
    try {
      const res = await fetch(`${API_BASE}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.value}`,
          'x-tenant-id': tenantId.value
        },
        body: JSON.stringify({
          title: layout.value.title + ' (答题卡模板)',
          type: 'answer-sheet',
          content: JSON.stringify(data),
          visibility: 'PRIVATE',
          metadata: {
            layout: layout.value,
            paperSize: layout.value.paperSize
          }
        })
      })
      if (!res.ok) throw new Error('保存失败')
      saveMessage.value = '✅ 保存成功！'
      setTimeout(() => saveMessage.value = '', 3000)
    } catch (e: any) {
      alert('保存失败: ' + e.message)
    } finally {
      isSaving.value = false
    }
  }
}
</script>

<template>
  <div class="designer">
    
    <!-- Top Settings Bar -->
    <div class="settings-bar no-print">
      <div class="bar-left">
        <div class="field-group">
          <label><Icon icon="mdi:format-title" /> 试卷标题</label>
          <input v-model="layout.title" class="input slim" placeholder="请输入标题" style="width: 240px;" />
        </div>
        <div class="field-group">
          <label><Icon icon="mdi:file-outline" /> 纸张</label>
          <select v-model="layout.paperSize" class="input slim" style="width: 100px;">
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        </div>
        <div class="field-group separator"></div>
        <div class="field-group">
          <label><Icon icon="mdi:account-group-outline" /> 考生</label>
          <button class="student-btn" @click="showStudentModal = true">
            已选 {{ selectedStudents.length }} 人 <Icon icon="mdi:chevron-down" />
          </button>
        </div>
      </div>

      <div class="bar-right">
        <span v-if="saveMessage" class="success-tag">{{ saveMessage }}</span>
        <button class="action-btn-main outline" @click="saveLayout" :disabled="isSaving">
            <Icon icon="mdi:cloud-upload" /> 保存模板
        </button>
        <button v-if="activeTab === 'print'" class="action-btn-main primary" @click="print">
            <Icon icon="mdi:printer" /> 打印
        </button>
        <div class="mode-switch">
           <button :class="{ active: activeTab === 'design' }" @click="activeTab = 'design'">设计</button>
           <button :class="{ active: activeTab === 'print' }" @click="activeTab = 'print'">预览</button>
        </div>
      </div>
    </div>

    <!-- Main Workspace (Three Columns) -->
    <div v-show="activeTab === 'design'" class="workspace no-print">
      
      <!-- LEFT: Structure List -->
      <div class="side-panel left-panel">
         <div class="panel-header">
           <span>题目列表 ({{ layout.sections.length }})</span>
         </div>
         <div class="structure-list">
           <div v-for="(sec, idx) in layout.sections" :key="sec.id" class="structure-item" @click="openEditModal(sec, idx)">
              <div class="item-icon">
                <Icon :icon="typeIcons[sec.type]" />
              </div>
              <div class="item-info">
                <div class="item-title">{{ idx + 1 }}. {{ sec.title }}</div>
                <div class="item-meta">{{ sec.count }} 题 <span v-if="sec.type==='choice'">· {{ sec.options }}项</span></div>
              </div>
              <button class="item-del" @click.stop="removeSection(idx)">
                <Icon icon="mdi:close" />
              </button>
           </div>
           <div v-if="layout.sections.length === 0" class="empty-tip">
             暂无题目，请从右侧添加
           </div>
         </div>
      </div>

      <!-- CENTER: Preview -->
      <div class="preview-stage">
         <div class="stage-scroller">
           <StudentAnswerSheet 
             ref="previewSheetRef"
             v-if="selectedStudents.length > 0" 
             :student="selectedStudents[0]" 
             :layout="layout" 
             class="preview-sheet"
           />
           <StudentAnswerSheet
             ref="previewSheetRef"
             v-else
             :student="{ id: 'demo', name: '张三 (示例)', studentId: '20230001', class: '七年级1班' }"
             :layout="layout"
             class="preview-sheet"
           />
         </div>
      </div>

      <!-- RIGHT: Toolbox -->
      <div class="side-panel right-panel">
         <div class="panel-header">添加题型</div>
         <div class="tools-grid">
             <button v-for="(label, type) in typeLabels" :key="type" class="tool-tile" @click="openAddModal(type as string)">
               <Icon :icon="typeIcons[type]" width="24" />
               <span>{{ label }}</span>
             </button>
         </div>
      </div>

    </div>

    <!-- Print Mode -->
    <div v-show="activeTab === 'print'" class="print-view">
       <div v-if="selectedStudents.length === 0" class="no-print" style="text-align:center;padding:50px;">
         <h3 style="color:#666">请先在顶部选择考生</h3>
       </div>
       <div v-else>
          <div v-for="student in selectedStudents" :key="student.id" class="print-page">
            <StudentAnswerSheet :student="student" :layout="layout" />
          </div>
       </div>
    </div>

    <!-- Add/Edit Section Modal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ isEditing ? '编辑' : '添加' }} {{ typeLabels[modalForm.type] }}</h3>
          <button @click="showModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>区域标题</label>
            <input v-model="modalForm.title" class="input" />
          </div>
          <div class="form-group">
            <label>题目内容 (可选)</label>
            <textarea v-model="modalForm.content" class="input" rows="3" placeholder="在此输入题目文本..."></textarea>
          </div>
          <div class="form-row">
             <div class="form-group">
                <label>题目数量</label>
                <input type="number" v-model="modalForm.count" class="input" />
             </div>
             <div v-if="['short-answer','comprehensive','calculation'].includes(modalForm.type)" class="form-group">
                <label>高度 (行数/Px)</label>
                <input type="number" v-model="modalForm.lines" class="input" />
             </div>
          </div>
          <div v-if="modalForm.type === 'choice'" class="form-group">
            <label>选项数量</label>
            <div class="radio-group">
              <label><input type="radio" v-model="modalForm.options" :value="4"> 4项</label>
              <label><input type="radio" v-model="modalForm.options" :value="5"> 5项</label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" @click="showModal = false">取消</button>
          <button class="primary" @click="confirmModal">确认</button>
        </div>
      </div>
    </div>

    <!-- Student Selector Modal -->
    <div v-if="showStudentModal" class="modal-overlay">
      <div class="modal-card wide">
        <div class="modal-header">
          <h3>选择考生</h3>
          <button @click="showStudentModal = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <StudentSelector v-model="selectedStudents" />
        </div>
        <div class="modal-footer">
          <button class="primary" @click="showStudentModal = false">完成 (已选 {{ selectedStudents.length }} 人)</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.designer { padding-bottom: 50px; height: calc(100vh - 60px); display: flex; flex-direction: column; background: #e5e7eb; }

/* Top Settings Bar */
.settings-bar {
  background: #fff; height: 56px; border-bottom: 1px solid #d1d5db;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; flex-shrink: 0; z-index: 5;
}
.bar-left { display: flex; align-items: center; gap: 16px; }
.bar-right { display: flex; align-items: center; gap: 12px; }

.field-group { display: flex; align-items: center; gap: 8px; }
.field-group label { font-size: 13px; color: #6b7280; font-weight: 500; display: flex; align-items: center; gap: 4px; }
.input.slim { padding: 6px 10px; font-size: 13px; border-radius: 6px; border: 1px solid #d1d5db; }
.separator { width: 1px; height: 24px; background: #e5e7eb; margin: 0 8px; }

.student-btn {
  background: #f3f4f6; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 6px;
  font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #374151;
}
.student-btn:hover { background: #e5e7eb; }

.mode-switch { background: #f3f4f6; padding: 3px; border-radius: 6px; display: flex; gap: 2px; }
.mode-switch button {
  border: none; background: transparent; padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; color: #6b7280;
}
.mode-switch button.active { background: #fff; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

.action-btn-main {
  display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.action-btn-main.outline { background: #fff; border: 1px solid #d1d5db; color: #374151; }
.action-btn-main.primary { background: #2563eb; border: 1px solid #2563eb; color: #fff; }
.success-tag { font-size: 12px; color: #059669; background: #d1fae5; padding: 4px 8px; border-radius: 4px; }

/* Workspace - 3 Columns */
.workspace { flex: 1; display: flex; overflow: hidden; }

.side-panel {
  width: 260px; flex-shrink: 0; background: #fff; display: flex; flex-direction: column; z-index: 2;
  border-right: 1px solid #d1d5db; /* Default border */
}
.side-panel.left-panel { border-right: 1px solid #d1d5db; border-left: none; }
.side-panel.right-panel { border-left: 1px solid #d1d5db; border-right: none; width: 220px; }

.panel-header {
  padding: 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; font-weight: 600; color: #374151;
  display: flex; justify-content: space-between; align-items: center;
}

/* Structure List */
.structure-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.structure-item {
  display: flex; align-items: center; gap: 10px; padding: 12px; 
  background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer;
  transition: all 0.2s;
}
.structure-item:hover { border-color: #3b82f6; background: #eff6ff; }
.item-icon { color: #6b7280; }
.item-info { flex: 1; overflow: hidden; }
.item-title { font-size: 13px; font-weight: 500; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { font-size: 11px; color: #9ca3af; }
.item-del { border: none; background: transparent; color: #d1d5db; cursor: pointer; padding: 4px; }
.item-del:hover { color: #ef4444; }
.empty-tip { text-align: center; color: #9ca3af; font-size: 12px; padding: 20px; }

/* Preview Stage */
.preview-stage { 
  flex: 1; 
  background: #525659; 
  overflow: auto; 
  display: flex; 
  justify-content: center; 
  padding: 40px;
}
.stage-scroller { display: flex; flex-direction: column; align-items: center; min-height: 100%; }
.preview-sheet { 
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: scale(0.85); transform-origin: top center; margin-bottom: -150px;
}

/* Toolbox Grid */
.tools-grid { padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; overflow-y: auto; }
.tool-tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 12px; color: #4b5563; cursor: pointer; transition: all 0.2s;
}
.tool-tile:hover { border-color: #3b82f6; color: #3b82f6; background: #eff6ff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-card { background: #fff; width: 400px; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
.modal-card.wide { width: 600px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-header h3 { margin: 0; font-size: 18px; }
.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #9ca3af; }
.modal-body { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; }

/* Forms */
.form-group label { display: block; font-size: 13px; margin-bottom: 6px; color: #4b5563; font-weight: 500; }
.form-row { display: flex; gap: 16px; }
.form-row .form-group { flex: 1; }
.input { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 14px; font-family: inherit; }
textarea.input { resize: vertical; }
.radio-group { display: flex; gap: 16px; font-size: 14px; }

/* Buttons */
button.secondary { background: #fff; border: 1px solid #d1d5db; color: #374151; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
button.primary { background: #2563eb; border: 1px solid #2563eb; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; }

@media print {
  .no-print { display: none !important; }
  .designer { height: auto; display: block; }
  .print-view { display: block !important; }
  .print-page { break-after: page; page-break-after: always; }
}
</style>