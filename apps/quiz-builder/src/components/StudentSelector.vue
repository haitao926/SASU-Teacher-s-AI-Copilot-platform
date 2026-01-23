<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useStorage } from '@vueuse/core'

export interface Student {
  id: string
  name: string
  studentId: string
  class: string
}

const props = defineProps<{
  modelValue: Student[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Student[]): void
}>()

const token = useStorage('iai-token', '')
const tenantId = useStorage('iai-tenant', 'default')
// Remove /quizzes if present to get base API url
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes').replace('/quizzes', '')

const students = ref<Student[]>([])
const loading = ref(false)
const error = ref('')
const selectedClass = ref('')

// Fetch students
async function fetchStudents() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/admin/students?pageSize=200`, {
      headers: {
        Authorization: token.value ? `Bearer ${token.value}` : '',
        'x-tenant-id': tenantId.value
      }
    })
    if (!res.ok) throw new Error('获取学生名单失败，请检查是否登录或权限')
    const data = await res.json()
    students.value = data.items || []
  } catch (e: any) {
    error.value = e.message
    // Fallback mock data for dev if no auth
    if (!token.value) {
      students.value = [
        { id: '1', name: '张三', studentId: '2023001', class: '七年级1班' },
        { id: '2', name: '李四', studentId: '2023002', class: '七年级1班' },
        { id: '3', name: '王五', studentId: '2023003', class: '七年级2班' },
        { id: '4', name: '赵六', studentId: '2023004', class: '七年级2班' },
        { id: '5', name: '钱七', studentId: '2023005', class: '七年级3班' },
        { id: '6', name: '孙八', studentId: '2023006', class: '七年级3班' }
      ]
    }
  } finally {
    loading.value = false
  }
}

// Filter classes
const classes = computed(() => {
  const s = new Set(students.value.map(s => s.class).filter(Boolean))
  return Array.from(s).sort()
})

const filteredStudents = computed(() => {
  if (!selectedClass.value) return students.value
  return students.value.filter(s => s.class === selectedClass.value)
})

function toggleSelection(student: Student) {
  const newSelection = [...props.modelValue]
  const idx = newSelection.findIndex(s => s.id === student.id)
  if (idx > -1) {
    newSelection.splice(idx, 1)
  } else {
    newSelection.push(student)
  }
  emit('update:modelValue', newSelection)
}

function selectAll() {
  const currentIds = new Set(props.modelValue.map(s => s.id))
  const newSelection = [...props.modelValue]
  filteredStudents.value.forEach(s => {
    if (!currentIds.has(s.id)) {
      newSelection.push(s)
    }
  })
  emit('update:modelValue', newSelection)
}

function clearSelection() {
  emit('update:modelValue', [])
}

onMounted(() => {
  fetchStudents()
})
</script>

<template>
  <div class="student-selector">
    <div class="toolbar">
      <select v-model="selectedClass" class="input">
        <option value="">全部班级</option>
        <option v-for="c in classes" :key="c" :value="c">{{ c }}</option>
      </select>
      <button @click="fetchStudents" :disabled="loading" class="btn">
        {{ loading ? '刷新' : '刷新' }}
      </button>
      <div class="spacer"></div>
      <button @click="selectAll" class="btn primary">全选当前</button>
      <button @click="clearSelection" class="btn">清空</button>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>

    <div class="grid">
      <div 
        v-for="s in filteredStudents" 
        :key="s.id"
        class="student-card"
        :class="{ selected: modelValue.some(sel => sel.id === s.id) }"
        @click="toggleSelection(s)"
      >
        <div class="s-name">{{ s.name }}</div>
        <div class="s-meta">{{ s.studentId }} | {{ s.class }}</div>
        <Icon v-if="modelValue.some(sel => sel.id === s.id)" icon="mdi:check-circle" class="check-icon" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.spacer { flex: 1; }
.btn { padding: 6px 12px; border: 1px solid #d1d5db; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn.primary { background: #3b82f6; color: #fff; border-color: #3b82f6; }
.input { padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  padding: 10px;
  border-radius: 8px;
  background: #f9fafb;
}
.student-card {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  user-select: none;
  position: relative;
  transition: all 0.2s;
}
.student-card:hover { border-color: #3b82f6; }
.student-card.selected {
  background: #eff6ff;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}
.s-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
.s-meta { font-size: 12px; color: #6b7280; }
.check-icon { position: absolute; top: 8px; right: 8px; color: #3b82f6; font-size: 16px; }
.error-msg { color: #ef4444; font-size: 12px; margin-bottom: 10px; }
</style>