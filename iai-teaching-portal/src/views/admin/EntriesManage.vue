<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { EntryCard, Group } from '@/types'
import { useAuth } from '@/composables/useAuth'

const entries = ref<EntryCard[]>([])
const groups = ref<Group[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const currentEntry = ref<EntryCard | null>(null)
const isEditing = ref(false)
const saving = ref(false)
const { hasPermission, token } = useAuth()
const canManageEntries = computed(() => hasPermission('entries.manage'))

// 表单数据
const formData = ref<Partial<EntryCard>>({
  id: '',
  name: '',
  description: '',
  icon: 'gradient-blue',
  tags: [],
  url: '',
  status: 'available',
  group: '',
  usage: 0,
  order: 0
})

const tagInput = ref('')

// 加载数据（使用后端 API）
async function loadData() {
  loading.value = true
  try {
    const res = await fetch('/api/entries/config')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    groups.value = data.groups || []
    entries.value = (data.entries || []).map((e: any) => ({
      ...e,
      group: e.group ?? e.groupId ?? '',
      tags: e.tags ?? [],
      usage: e.usage ?? 0
    }))
  } catch (error) {
    console.error('加载数据失败:', error)
    alert('加载数据失败，请检查登录状态或后端服务')
  } finally {
    loading.value = false
  }
}

loadData()

// 搜索
const searchQuery = ref('')
const filteredEntries = computed(() => {
  if (!searchQuery.value) return entries.value
  const query = searchQuery.value.toLowerCase()
  return entries.value.filter(entry =>
    entry.name.toLowerCase().includes(query) ||
    entry.description.toLowerCase().includes(query) ||
    entry.tags.some(tag => tag.toLowerCase().includes(query))
  )
})

// 打开新增对话框
function openAddDialog() {
  isEditing.value = false
  currentEntry.value = null
  formData.value = {
    id: '',
    name: '',
    description: '',
    icon: 'gradient-blue',
    tags: [],
    url: '',
    status: 'available',
    group: groups.value[0]?.id || '',
    usage: 0,
    order: entries.value.length + 1
  }
  dialogVisible.value = true
}

// 打开编辑对话框
function openEditDialog(entry: EntryCard) {
  isEditing.value = true
  currentEntry.value = entry
  formData.value = { ...entry }
  dialogVisible.value = true
}

// 保存
async function handleSave() {
  if (!formData.value.name || !formData.value.url) {
    alert('请填写必填项')
    return
  }

  if (!canManageEntries.value) {
    alert('无权限保存入口配置')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: formData.value.name,
      description: formData.value.description || '',
      icon: formData.value.icon || 'gradient-blue',
      url: formData.value.url,
      status: formData.value.status || 'available',
      order: formData.value.order ?? 0,
      group: formData.value.group || '',
      tags: formData.value.tags || [],
      usage: formData.value.usage ?? 0
    }

    const isEdit = isEditing.value && currentEntry.value
    const endpoint = isEdit ? `/api/admin/entries/${currentEntry.value!.id}` : '/api/admin/entries'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(endpoint, {
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
    alert('保存成功')
  } catch (error: any) {
    console.error('保存失败', error)
    alert(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 删除
async function handleDelete(entry: EntryCard) {
  if (confirm(`确定删除"${entry.name}"吗？`)) {
    if (!canManageEntries.value) {
      alert('无权限删除入口配置')
      return
    }

    try {
      const res = await fetch(`/api/admin/entries/${entry.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token.value}` }
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '删除失败')
      }
      await loadData()
    } catch (error: any) {
      console.error('删除失败', error)
      alert(error.message || '删除失败')
    }
  }
}

// 添加标签
function addTag() {
  if (tagInput.value && !formData.value.tags?.includes(tagInput.value)) {
    if (!formData.value.tags) formData.value.tags = []
    formData.value.tags.push(tagInput.value)
    tagInput.value = ''
  }
}

// 移除标签
function removeTag(tag: string) {
  if (formData.value.tags) {
    formData.value.tags = formData.value.tags.filter(t => t !== tag)
  }
}

// 导出配置
function exportConfig() {
  const data = {
    groups: groups.value,
    entries: entries.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'entries-config.json'
  a.click()
  URL.revokeObjectURL(url)
}

const gradientOptions = [
  { value: 'gradient-purple', label: '紫色渐变', class: 'from-purple-400 to-purple-600' },
  { value: 'gradient-blue', label: '蓝色渐变', class: 'from-blue-400 to-blue-600' },
  { value: 'gradient-green', label: '绿色渐变', class: 'from-green-400 to-green-600' },
  { value: 'gradient-orange', label: '橙色渐变', class: 'from-orange-400 to-orange-600' },
  { value: 'gradient-red', label: '红色渐变', class: 'from-red-400 to-red-600' },
  { value: 'gradient-teal', label: '青色渐变', class: 'from-teal-400 to-teal-600' },
  { value: 'gradient-pink', label: '粉色渐变', class: 'from-pink-400 to-pink-600' },
  { value: 'gradient-indigo', label: '靛色渐变', class: 'from-indigo-400 to-indigo-600' },
]

const statusOptions = [
  { value: 'available', label: '可用', color: 'green' },
  { value: 'maintenance', label: '维护中', color: 'orange' },
  { value: 'new', label: '新功能', color: 'blue' },
]
</script>

<template>
  <div class="entries-manage">
    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="flex items-center gap-4">
        <!-- 搜索 -->
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索入口..."
            class="search-input"
          />
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class="btn btn-secondary" @click="exportConfig">
          <Icon icon="mdi:download" class="w-4 h-4" />
          导出配置
        </button>
        <button class="btn btn-primary" @click="openAddDialog">
          <Icon icon="mdi:plus" class="w-4 h-4" />
          新增入口
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th width="50">序号</th>
            <th width="200">名称</th>
            <th>描述</th>
            <th width="120">分组</th>
            <th width="200">标签</th>
            <th width="100">状态</th>
            <th width="80">使用量</th>
            <th width="150">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(entry, index) in filteredEntries" :key="entry.id">
            <td>{{ index + 1 }}</td>
            <td class="font-medium">{{ entry.name }}</td>
            <td class="text-gray-600 text-sm">{{ entry.description }}</td>
            <td>{{ groups.find(g => g.id === entry.group)?.name }}</td>
            <td>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tag in entry.tags"
                  :key="tag"
                  class="tag-sm"
                >
                  {{ tag }}
                </span>
              </div>
            </td>
            <td>
              <span
                class="status-badge"
                :class="`status-${entry.status}`"
              >
                {{ statusOptions.find(s => s.value === entry.status)?.label }}
              </span>
            </td>
            <td class="text-center">{{ entry.usage }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn-icon" title="编辑" @click="openEditDialog(entry)">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />
                </button>
                <button class="btn-icon text-red-600" title="删除" @click="handleDelete(entry)">
                  <Icon icon="mdi:delete" class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="8" class="text-center py-8 text-gray-500">
              <Icon icon="mdi:loading" class="w-6 h-6 animate-spin inline-block" />
              加载中...
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 空状态 -->
      <div v-if="!loading && filteredEntries.length === 0" class="empty-state">
        <Icon icon="mdi:inbox-outline" class="w-16 h-16 text-gray-300 mb-2" />
        <p class="text-gray-500">暂无数据</p>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ isEditing ? '编辑入口' : '新增入口' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <!-- 名称 -->
            <div class="form-item">
              <label class="form-label">名称 *</label>
              <input
                v-model="formData.name"
                type="text"
                class="form-input"
                placeholder="请输入应用名称"
              />
            </div>

            <!-- URL -->
            <div class="form-item">
              <label class="form-label">链接地址 *</label>
              <input
                v-model="formData.url"
                type="url"
                class="form-input"
                placeholder="https://example.com"
              />
            </div>

            <!-- 描述 -->
            <div class="form-item col-span-2">
              <label class="form-label">描述</label>
              <textarea
                v-model="formData.description"
                class="form-textarea"
                rows="3"
                placeholder="请输入应用描述"
              />
            </div>

            <!-- 分组 -->
            <div class="form-item">
              <label class="form-label">分组</label>
              <select v-model="formData.group" class="form-select">
                <option v-for="group in groups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </option>
              </select>
            </div>

            <!-- 图标 -->
            <div class="form-item">
              <label class="form-label">图标渐变</label>
              <select v-model="formData.icon" class="form-select">
                <option v-for="opt in gradientOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- 状态 -->
            <div class="form-item">
              <label class="form-label">状态</label>
              <select v-model="formData.status" class="form-select">
                <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- 排序 -->
            <div class="form-item">
              <label class="form-label">排序</label>
              <input
                v-model.number="formData.order"
                type="number"
                class="form-input"
                min="0"
              />
            </div>

            <!-- 标签 -->
            <div class="form-item col-span-2">
              <label class="form-label">标签</label>
              <div class="flex gap-2 mb-2">
                <input
                  v-model="tagInput"
                  type="text"
                  class="form-input flex-1"
                  placeholder="输入标签后回车"
                  @keyup.enter="addTag"
                />
                <button class="btn btn-secondary" @click="addTag">
                  <Icon icon="mdi:plus" class="w-4 h-4" />
                  添加
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in formData.tags"
                  :key="tag"
                  class="tag-editable"
                >
                  {{ tag }}
                  <button @click="removeTag(tag)">
                    <Icon icon="mdi:close" class="w-3 h-3" />
                  </button>
                </span>
              </div>
            </div>

          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="dialogVisible = false">
            取消
          </button>
          <button class="btn btn-primary" @click="handleSave">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.entries-manage {
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

.search-box {
  position: relative;
  width: 300px;
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
  outline: none;
  transition: all var(--transition-base);
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  padding: var(--spacing-4) var(--spacing-4);
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
}

tbody tr {
  border-bottom: 1px solid var(--gray-100);
  transition: background var(--transition-base);
}

tbody tr:hover {
  background: var(--gray-50);
}

td {
  padding: var(--spacing-4);
  font-size: 14px;
  color: var(--gray-900);
}

.tag-sm {
  display: inline-block;
  padding: 2px 8px;
  background: var(--gray-100);
  color: var(--gray-700);
  border-radius: var(--radius-md);
  font-size: 12px;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

.status-available {
  background: #ecfdf5;
  color: #059669;
}

.status-maintenance {
  background: #fff7ed;
  color: #ea580c;
}

.status-new {
  background: #eff6ff;
  color: #2563eb;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--transition-base);
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}

.btn-icon {
  padding: var(--spacing-2);
  color: var(--gray-600);
  transition: all var(--transition-base);
  border-radius: var(--radius-md);
}

.btn-icon:hover {
  background: var(--gray-100);
  color: var(--primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-16) 0;
}

/* 对话框 */
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
  max-width: 800px;
  max-height: 90vh;
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
  color: var(--gray-900);
}

.dialog-close {
  padding: var(--spacing-1);
  color: var(--gray-500);
  transition: all var(--transition-base);
  border-radius: var(--radius-md);
}

.dialog-close:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.dialog-body {
  flex: 1;
  padding: var(--spacing-6);
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  border-top: 1px solid var(--gray-200);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-4);
}

.form-item {
  display: flex;
  flex-direction: column;
}

.form-item.col-span-2 {
  grid-column: span 2;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-700);
  margin-bottom: var(--spacing-2);
}

.form-input,
.form-select,
.form-textarea {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 14px;
  outline: none;
  transition: all var(--transition-base);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-checkbox {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.tag-editable {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: 4px 8px;
  background: var(--primary);
  color: white;
  border-radius: var(--radius-md);
  font-size: 12px;
}

.tag-editable button {
  padding: 2px;
  color: white;
  opacity: 0.8;
  transition: opacity var(--transition-base);
  border-radius: var(--radius-sm);
}

.tag-editable button:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
}
</style>
