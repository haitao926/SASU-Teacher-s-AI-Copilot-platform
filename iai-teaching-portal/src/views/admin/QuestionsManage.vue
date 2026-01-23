<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'
import AssetPickerDialog from '@/components/assets/AssetPickerDialog.vue'

interface Question {
  id: string
  stem: string
  type: string
  subject?: string
  grade?: string
  difficulty: number
  status: string
  updatedAt: string
}

const { token, hasPermission } = useAuth()
const canManageAll = computed(() => hasPermission('questions.manage_all'))
const questions = ref<Question[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchQuery = ref('')
const filterSubject = ref('ALL')
const filterStatus = ref('ALL')
const assetPickerOpen = ref(false)
const importTextDialogVisible = ref(false)
const importing = ref(false)

const importForm = ref({
  text: '',
  subject: '',
  grade: '',
  difficulty: 3,
  status: 'DRAFT' as 'DRAFT' | 'PUBLISHED'
})

const formData = ref({
  stem: '',
  type: 'single',
  subject: '',
  grade: '',
  difficulty: 3,
  optionsText: '',
  answerText: '',
  analysis: ''
})

async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value)
    })
    if (searchQuery.value) params.append('keyword', searchQuery.value)
    if (filterSubject.value !== 'ALL') params.append('subject', filterSubject.value)
    if (filterStatus.value !== 'ALL') params.append('status', filterStatus.value)
    const res = await fetch(`/api/questions?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!res.ok) throw new Error('加载失败')
    const data = await res.json()
    questions.value = data.items
    total.value = data.total
  } catch (e) {
    console.error(e)
    alert('加载题库失败')
  } finally {
    loading.value = false
  }
}

loadData()

const filtered = computed(() => {
  if (!searchQuery.value) return questions.value
  const q = searchQuery.value.toLowerCase()
  return questions.value.filter(item => item.stem.toLowerCase().includes(q))
})

function openAddDialog() {
  isEditing.value = false
  editingId.value = null
  formData.value = {
    stem: '',
    type: 'single',
    subject: '',
    grade: '',
    difficulty: 3,
    optionsText: '',
    answerText: '',
    analysis: ''
  }
  dialogVisible.value = true
}

function openImportFromAsset() {
  assetPickerOpen.value = true
}

function openImportFromText() {
  importForm.value = { text: '', subject: '', grade: '', difficulty: 3, status: 'DRAFT' }
  importTextDialogVisible.value = true
}

async function importQuestions(payload: any) {
  if (!token.value) {
    alert('请先登录')
    return
  }
  importing.value = true
  try {
    const res = await fetch('/api/questions/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '导入失败')
    }
    const data = await res.json()
    alert(`导入完成：新增 ${data.created || 0} 题`)
    page.value = 1
    await loadData()
  } catch (e: any) {
    alert(e.message || '导入失败')
  } finally {
    importing.value = false
  }
}

async function handleImportText() {
  if (!importForm.value.text.trim()) {
    alert('请粘贴要导入的文本')
    return
  }
  await importQuestions({
    text: importForm.value.text,
    subject: importForm.value.subject || undefined,
    grade: importForm.value.grade || undefined,
    difficulty: importForm.value.difficulty,
    status: importForm.value.status
  })
  importTextDialogVisible.value = false
}

function openEditDialog(item: Question) {
  isEditing.value = true
  editingId.value = item.id
  formData.value = {
    stem: item.stem,
    type: item.type,
    subject: item.subject || '',
    grade: item.grade || '',
    difficulty: item.difficulty || 3,
    optionsText: '',
    answerText: '',
    analysis: ''
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!formData.value.stem) {
    alert('请填写题干')
    return
  }
  const url = isEditing.value ? `/api/questions/${editingId.value}` : '/api/questions'
  const method = isEditing.value ? 'PUT' : 'POST'
  try {
    const payload: any = {
      stem: formData.value.stem,
      type: formData.value.type,
      subject: formData.value.subject,
      grade: formData.value.grade,
      difficulty: formData.value.difficulty,
      analysis: formData.value.analysis
    }
    if (formData.value.optionsText) {
      payload.options = formData.value.optionsText.split('\n').map(t => t.trim()).filter(Boolean)
    }
    if (formData.value.answerText) {
      payload.answer = formData.value.answerText
    }
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '保存失败')
    }
    await loadData()
    dialogVisible.value = false
  } catch (e: any) {
    alert(e.message || '保存失败')
  }
}

async function handleDelete(item: Question) {
  if (!confirm(`确定归档题目 "${item.stem.slice(0, 20)}..." ?`)) return
  try {
    const res = await fetch(`/api/questions/${item.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!res.ok) throw new Error('删除失败')
    await loadData()
  } catch (e) {
    alert('删除失败')
  }
}

async function handlePublish(item: Question) {
  if (!canManageAll.value) {
    alert('无权限发布')
    return
  }
  try {
    const res = await fetch(`/api/questions/${item.id}/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!res.ok) throw new Error('发布失败')
    await loadData()
  } catch (e) {
    alert('发布失败')
  }
}

async function exportQuestions() {
  if (!canManageAll.value) {
    alert('无权限导出')
    return
  }
  const res = await fetch('/api/questions/export', {
    headers: { 'Authorization': `Bearer ${token.value}` }
  })
  if (!res.ok) {
    alert('导出失败')
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'questions.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
function goPage(p: number) {
  const next = Math.min(Math.max(1, p), totalPages.value)
  if (next !== page.value) {
    page.value = next
    loadData()
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div class="questions">
    <div class="action-bar">
      <div class="filters">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索题干..."
            class="search-input"
            @keyup.enter="page = 1; loadData()"
          />
        </div>
        <select v-model="filterSubject" class="form-select w-32" @change="page = 1; loadData()">
          <option value="ALL">全部学科</option>
          <option value="语文">语文</option>
          <option value="数学">数学</option>
          <option value="英语">英语</option>
          <option value="物理">物理</option>
          <option value="化学">化学</option>
        </select>
        <select v-model="filterStatus" class="form-select w-32" @change="page = 1; loadData()">
          <option value="ALL">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PUBLISHED">已发布</option>
          <option value="ARCHIVED">已归档</option>
        </select>
      </div>
      <div class="flex gap-3">
        <button class="btn btn-secondary" :disabled="importing" @click="openImportFromAsset">
          <Icon icon="mdi:folder-upload-outline" class="w-4 h-4" />
          从资源导入
        </button>
        <button class="btn btn-secondary" :disabled="importing" @click="openImportFromText">
          <Icon icon="mdi:text-box-plus-outline" class="w-4 h-4" />
          从文本导入
        </button>
        <button class="btn btn-secondary" @click="exportQuestions">
          <Icon icon="mdi:download" class="w-4 h-4" />
          导出 CSV
        </button>
        <button class="btn btn-primary" @click="openAddDialog">
          <Icon icon="mdi:plus" class="w-4 h-4" />
          新建题目
        </button>
      </div>
    </div>

    <AssetPickerDialog
      v-model:open="assetPickerOpen"
      title="从资源库导入题目"
      hint="选择一份包含题目文本的资源（会读取资源 content 字段）"
      @confirm="(picked) => importQuestions({ assetId: picked[0]?.id })"
    />

    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th width="60">#</th>
            <th>题干</th>
            <th width="120">学科</th>
            <th width="80">难度</th>
            <th width="100">状态</th>
            <th width="180">更新时间</th>
            <th width="140">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(item, index) in filtered" :key="item.id">
            <td>{{ (page - 1) * pageSize + index + 1 }}</td>
            <td class="font-medium truncate max-w-xl">{{ item.stem }}</td>
            <td>{{ item.subject || '—' }}</td>
            <td>{{ item.difficulty || 3 }}</td>
            <td>
              <span
                class="badge"
                :class="{
                  'badge-green': item.status === 'PUBLISHED',
                  'badge-gray': item.status === 'DRAFT',
                  'badge-red': item.status === 'ARCHIVED'
                }"
              >
                {{ item.status }}
              </span>
            </td>
            <td class="text-sm text-gray-500">{{ formatDate(item.updatedAt) }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn-icon" title="编辑" @click="openEditDialog(item)">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />
                </button>
                <button class="btn-icon text-green-600" title="发布" @click="handlePublish(item)" :disabled="item.status === 'PUBLISHED'">
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                </button>
                <button class="btn-icon text-red-600" title="归档" @click="handleDelete(item)">
                  <Icon icon="mdi:archive" class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="7" class="text-center py-8 text-gray-500">
              <Icon icon="mdi:loading" class="w-6 h-6 animate-spin inline-block" />
              加载中...
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && filtered.length === 0" class="empty-state">
        <Icon icon="mdi:comment-question" class="w-12 h-12 text-gray-300 mb-2" />
        <p class="text-gray-500">暂无题目</p>
      </div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <button class="btn btn-secondary" @click="goPage(page - 1)" :disabled="page <= 1">上一页</button>
      <span class="text-sm text-gray-600">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
      <button class="btn btn-secondary" @click="goPage(page + 1)" :disabled="page >= totalPages">下一页</button>
    </div>

    <!-- Dialog -->
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ isEditing ? '编辑题目' : '新建题目' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">题干 *</label>
              <textarea v-model="formData.stem" class="form-input" rows="3" placeholder="请输入题干" />
            </div>
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">题型</label>
                <select v-model="formData.type" class="form-select">
                  <option value="single">单选</option>
                  <option value="multi">多选</option>
                  <option value="fill">填空</option>
                  <option value="short">简答</option>
                  <option value="essay">论述</option>
                </select>
              </div>
              <div class="form-item">
                <label class="form-label">难度 (1-5)</label>
                <input type="number" min="1" max="5" v-model.number="formData.difficulty" class="form-input" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">学科</label>
                <input v-model="formData.subject" class="form-input" placeholder="如：数学" />
              </div>
              <div class="form-item">
                <label class="form-label">年级</label>
                <input v-model="formData.grade" class="form-input" placeholder="如：高一" />
              </div>
            </div>
            <div class="form-item">
              <label class="form-label">选项（每行一个，可选）</label>
              <textarea v-model="formData.optionsText" class="form-input" rows="3" placeholder="A. 选项1\nB. 选项2" />
            </div>
            <div class="form-item">
              <label class="form-label">答案（可填文本或 JSON）</label>
              <input v-model="formData.answerText" class="form-input" placeholder="如：A 或 ['A','B']" />
            </div>
            <div class="form-item">
              <label class="form-label">解析</label>
              <textarea v-model="formData.analysis" class="form-input" rows="3" placeholder="简要解析" />
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="dialogVisible = false">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>

    <!-- Import Text Dialog -->
    <div v-if="importTextDialogVisible" class="dialog-overlay" @click.self="importTextDialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">从文本导入题目</h3>
          <button class="dialog-close" @click="importTextDialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">题目文本 *</label>
              <textarea v-model="importForm.text" class="form-input" rows="10" placeholder="支持格式：\n1. 题干...\nA. 选项...\nB. 选项...\n答案：A\n解析：..." />
            </div>
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">学科（可选）</label>
                <input v-model="importForm.subject" class="form-input" placeholder="如：数学" />
              </div>
              <div class="form-item">
                <label class="form-label">年级（可选）</label>
                <input v-model="importForm.grade" class="form-input" placeholder="如：高一" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">难度 (1-5)</label>
                <input type="number" min="1" max="5" v-model.number="importForm.difficulty" class="form-input" />
              </div>
              <div class="form-item">
                <label class="form-label">导入状态</label>
                <select v-model="importForm.status" class="form-select">
                  <option value="DRAFT">草稿</option>
                  <option value="PUBLISHED" :disabled="!canManageAll">已发布（仅管理员）</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="importTextDialogVisible = false">取消</button>
          <button class="btn btn-primary" :disabled="importing" @click="handleImportText">
            {{ importing ? '导入中...' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.questions {
  background: white;
  border-radius: var(--radius-xl);
  overflow: hidden;
}
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--gray-200);
}
.filters {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
}
.search-box {
  position: relative;
  width: 280px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--gray-400);
}
.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 14px;
}
.data-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
thead tr {
  background: var(--gray-50);
  border-bottom: 2px solid var(--gray-200);
}
th {
  padding: var(--spacing-4);
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
}
td {
  padding: var(--spacing-4);
  font-size: 14px;
  color: var(--gray-900);
}
tbody tr {
  border-bottom: 1px solid var(--gray-100);
  transition: background var(--transition-base);
}
tbody tr:hover {
  background: var(--gray-50);
}
.badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
}
.badge-green {
  background: #ecfdf3;
  color: #16a34a;
}
.badge-gray {
  background: #f8fafc;
  color: #475569;
}
.badge-red {
  background: #fef2f2;
  color: #ef4444;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}
.btn-icon {
  padding: var(--spacing-2);
  color: var(--gray-600);
  border-radius: var(--radius-md);
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-3);
  padding: var(--spacing-4) var(--spacing-6);
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-12) 0;
}
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-4);
}
.dialog {
  background: white;
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-6);
  border-bottom: 1px solid var(--gray-200);
}
.dialog-title {
  font-size: 18px;
  font-weight: 600;
}
.dialog-close {
  padding: 4px;
}
.dialog-body {
  padding: var(--spacing-6);
}
.dialog-footer {
  padding: var(--spacing-6);
  border-top: 1px solid var(--gray-200);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}
.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-4);
}
.form-item {
  display: flex;
  flex-direction: column;
}
.form-label {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: var(--spacing-2);
  color: var(--gray-700);
}
.form-input, .form-select, textarea.form-input {
  padding: 8px 12px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 14px;
  outline: none;
}
.form-input:focus, .form-select:focus, textarea.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>
