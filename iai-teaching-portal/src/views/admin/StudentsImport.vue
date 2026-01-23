<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'
import { read, utils } from 'xlsx'

const { token, hasPermission } = useAuth()
const canManageStudents = computed(() => hasPermission('students.manage'))
const importing = ref(false)
const message = ref('')
const students = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')

function downloadTemplate() {
  const sample = 'studentId,name,class\n2024010101,张三,701\n'
  const blob = new Blob([sample], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'students-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseDelimited(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map(h => h.trim())

  const idxAny = (keys: string[]) => {
    for (const k of keys) {
      const i = headers.indexOf(k)
      if (i !== -1) return i
    }
    return -1
  }

  const idxStudentId = idxAny(['studentId', '学号', '學號', '学籍号', '学籍號'])
  const idxName = idxAny(['name', '姓名', '学生姓名', '學生姓名'])
  const idxClass = idxAny(['class', '班级', '班級', 'className', 'Class'])
  const idxGrade = idxAny(['grade', '年级', '年級'])

  if (idxStudentId === -1 || idxName === -1) return []
  const rows: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter)
    const studentId = cols[idxStudentId]?.trim()
    const name = cols[idxName]?.trim()
    if (!studentId || !name) continue
    const classRaw = idxClass !== -1 ? cols[idxClass]?.trim() : ''
    const gradeRaw = idxGrade !== -1 ? cols[idxGrade]?.trim() : ''
    const className = gradeRaw && classRaw && !classRaw.includes('-') ? `${gradeRaw}-${classRaw}` : (classRaw || '')
    rows.push({
      studentId,
      name,
      class: className
    })
  }
  return rows
}

function parseExcel(buffer: ArrayBuffer) {
  const workbook = read(buffer, { type: 'array', codepage: 65001 })
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  const rows = utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][]
  if (!rows || rows.length === 0) return []

  const headers = (rows[0] ?? []).map((h) => String(h ?? '').trim())
  const idxAny = (keys: string[]) => {
    for (const k of keys) {
      const i = headers.indexOf(k)
      if (i !== -1) return i
    }
    return -1
  }

  // 支持学校导出的字段名（学号/入学年度/年级/班级/姓名/密码/性别/家庭住址/联系电话/家长姓名/班主任）
  const idxStudentId = idxAny(['学号', '學號', 'studentId'])
  const idxName = idxAny(['姓名', 'name'])
  const idxGrade = idxAny(['年级', '年級', 'grade'])
  const idxClassNo = idxAny(['班级', '班級', 'class', 'classNo'])

  if (idxStudentId === -1 || idxName === -1) {
    // fallback: assume fixed columns [学号,入学年度,年级,班级,姓名...]
    if (headers.length >= 5) {
      return rows
        .slice(1)
        .map((r) => ({
          studentId: String(r[0] ?? '').trim(),
          name: String(r[4] ?? '').trim(),
          class: `${String(r[2] ?? '').trim()}-${String(r[3] ?? '').trim()}`.replace(/^-|-$/g, '')
        }))
        .filter((r) => r.studentId && r.name)
    }
    return []
  }

  return rows
    .slice(1)
    .map((r) => {
      const studentId = String(r[idxStudentId] ?? '').trim()
      const name = String(r[idxName] ?? '').trim()
      const gradeRaw = idxGrade !== -1 ? String(r[idxGrade] ?? '').trim() : ''
      const classRaw = idxClassNo !== -1 ? String(r[idxClassNo] ?? '').trim() : ''
      const className = gradeRaw && classRaw && !classRaw.includes('-') ? `${gradeRaw}-${classRaw}` : (classRaw || '')
      return { studentId, name, class: className }
    })
    .filter((r) => r.studentId && r.name)
}

async function handleImport(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  const file = files[0]
  message.value = ''
  importing.value = true
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    let rows: any[] = []
    if (ext === 'xls' || ext === 'xlsx') {
      try {
        rows = parseExcel(await file.arrayBuffer())
      } catch (e) {
        rows = []
      }
      // 部分学校导出的 “.xls” 实际是 TSV 文本（伪 XLS），这里做兼容兜底
      if (rows.length === 0) {
        rows = parseDelimited(await file.text())
      }
    } else {
      rows = parseDelimited(await file.text())
    }
    if (rows.length === 0) {
      alert('未读取到有效数据，请检查表头与内容')
      return
    }
    const res = await fetch('/api/admin/students/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({ students: rows })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || '导入失败')
    }
    const data = await res.json()
    message.value = `导入成功：新增 ${data.created}，更新 ${data.updated}`
    await loadData()
  } catch (error: any) {
    alert(error.message || '导入失败')
  } finally {
    importing.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function loadData() {
  const params = new URLSearchParams({
    page: String(page.value),
    pageSize: String(pageSize.value),
    keyword: keyword.value
  })
  const res = await fetch(`/api/admin/students?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token.value}` }
  })
  if (res.ok) {
    const data = await res.json()
    students.value = data.items
    total.value = data.total
  }
}

async function exportStudents() {
  const res = await fetch('/api/admin/students/export', {
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
  a.download = 'students.csv'
  a.click()
  URL.revokeObjectURL(url)
}

loadData()
</script>

<template>
  <div class="students-import">
    <div class="header">
      <div>
        <h2>学生档案</h2>
        <p>支持 CSV/TSV/XLS/XLSX（至少包含：学号/姓名；可选：年级+班级），导入后可导出核对。</p>
      </div>
    <div class="actions">
      <button class="btn btn-secondary" @click="downloadTemplate">
        <Icon icon="mdi:download" class="w-4 h-4" /> 下载模板
      </button>
      <label class="btn btn-primary cursor-pointer">
        <input type="file" class="hidden" accept=".csv,.tsv,.txt,.xls,.xlsx" @change="handleImport" :disabled="!canManageStudents || importing" />
        <Icon icon="mdi:upload" class="w-4 h-4" />
        {{ importing ? '正在导入...' : '选择文件导入' }}
      </label>
      <button class="btn btn-secondary" @click="exportStudents">
          <Icon icon="mdi:export" class="w-4 h-4" /> 导出 CSV
        </button>
      </div>
    </div>

    <div v-if="message" class="alert-success">
      {{ message }}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th width="80">学号</th>
            <th width="150">姓名</th>
            <th width="100">班级</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stu in students" :key="stu.id">
            <td>{{ stu.studentId }}</td>
            <td>{{ stu.name }}</td>
            <td>{{ stu.class }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.students-import {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
  flex-wrap: wrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: var(--spacing-3);
  border-bottom: 1px solid var(--gray-100);
  text-align: left;
}

.alert-success {
  padding: var(--spacing-3);
  background: #ecfdf3;
  border: 1px solid #bbf7d0;
  color: #166534;
  border-radius: var(--radius-lg);
}
</style>
