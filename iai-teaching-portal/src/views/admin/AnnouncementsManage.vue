<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { Announcement } from '@/types'

const announcements = ref<Announcement[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const currentItem = ref<Announcement | null>(null)
const isEditing = ref(false)

const formData = ref<Partial<Announcement>>({
  id: '',
  title: '',
  content: '',
  time: '',
  tag: '通知',
  tagType: 'info',
  pinned: false,
  read: false
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await fetch('/config/announcements.json')
    const data = await res.json()
    announcements.value = data.announcements || []
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

loadData()

// 搜索
const searchQuery = ref('')
const filteredAnnouncements = computed(() => {
  if (!searchQuery.value) return announcements.value
  const query = searchQuery.value.toLowerCase()
  return announcements.value.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.content.toLowerCase().includes(query)
  )
})

// 打开新增对话框
function openAddDialog() {
  isEditing.value = false
  currentItem.value = null
  formData.value = {
    id: `ann-${Date.now()}`,
    title: '',
    content: '',
    time: new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '-'),
    tag: '通知',
    tagType: 'info',
    pinned: false,
    read: false
  }
  dialogVisible.value = true
}

// 打开编辑对话框
function openEditDialog(item: Announcement) {
  isEditing.value = true
  currentItem.value = item
  formData.value = { ...item }
  dialogVisible.value = true
}

// 保存
function handleSave() {
  if (!formData.value.title || !formData.value.content) {
    alert('请填写必填项')
    return
  }

  if (isEditing.value && currentItem.value) {
    // 编辑
    const index = announcements.value.findIndex(a => a.id === currentItem.value!.id)
    if (index !== -1) {
      announcements.value[index] = formData.value as Announcement
    }
  } else {
    // 新增
    announcements.value.unshift(formData.value as Announcement)
  }

  dialogVisible.value = false
  saveToFile()
}

// 删除
function handleDelete(item: Announcement) {
  if (confirm(`确定删除"${item.title}"吗？`)) {
    const index = announcements.value.findIndex(a => a.id === item.id)
    if (index !== -1) {
      announcements.value.splice(index, 1)
      saveToFile()
    }
  }
}

// 切换置顶
function togglePin(item: Announcement) {
  item.pinned = !item.pinned
  saveToFile()
}

// 保存到文件（模拟）
function saveToFile() {
  const data = { announcements: announcements.value }
  console.log('保存数据:', data)
  alert('保存成功！\n\n注意：实际项目中需要调用后端 API 保存数据。\n当前数据已打印到控制台，可复制到 public/config/announcements.json')
  console.log(JSON.stringify(data, null, 2))
}

// 导出配置
function exportConfig() {
  const data = { announcements: announcements.value }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'announcements-config.json'
  a.click()
  URL.revokeObjectURL(url)
}

const tagTypeOptions = [
  { value: 'success', label: '成功', color: 'green' },
  { value: 'warning', label: '警告', color: 'orange' },
  { value: 'info', label: '信息', color: 'blue' },
  { value: 'error', label: '错误', color: 'red' },
]

const tagOptions = ['通知', '维护', '更新', '新功能']
</script>

<template>
  <div class="announcements-manage">
    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="flex items-center gap-4">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索公告..."
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
          新增公告
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th width="50">序号</th>
            <th width="250">标题</th>
            <th>内容</th>
            <th width="150">时间</th>
            <th width="100">标签</th>
            <th width="80">类型</th>
            <th width="80">置顶</th>
            <th width="150">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(item, index) in filteredAnnouncements" :key="item.id">
            <td>{{ index + 1 }}</td>
            <td class="font-medium">{{ item.title }}</td>
            <td class="text-gray-600 text-sm truncate max-w-md">{{ item.content }}</td>
            <td class="text-sm text-gray-500">{{ item.time }}</td>
            <td>
              <span class="tag-sm">{{ item.tag }}</span>
            </td>
            <td>
              <span
                class="status-badge"
                :class="`status-${item.tagType}`"
              >
                {{ tagTypeOptions.find(t => t.value === item.tagType)?.label }}
              </span>
            </td>
            <td class="text-center">
              <button @click="togglePin(item)">
                <Icon
                  :icon="item.pinned ? 'mdi:pin' : 'mdi:pin-outline'"
                  class="w-5 h-5"
                  :class="item.pinned ? 'text-red-500' : 'text-gray-300'"
                />
              </button>
            </td>
            <td>
              <div class="flex gap-2">
                <button class="btn-icon" title="编辑" @click="openEditDialog(item)">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />
                </button>
                <button class="btn-icon text-red-600" title="删除" @click="handleDelete(item)">
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
      <div v-if="!loading && filteredAnnouncements.length === 0" class="empty-state">
        <Icon icon="mdi:inbox-outline" class="w-16 h-16 text-gray-300 mb-2" />
        <p class="text-gray-500">暂无公告</p>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ isEditing ? '编辑公告' : '新增公告' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <!-- 标题 -->
            <div class="form-item col-span-2">
              <label class="form-label">标题 *</label>
              <input
                v-model="formData.title"
                type="text"
                class="form-input"
                placeholder="请输入公告标题"
              />
            </div>

            <!-- 内容 -->
            <div class="form-item col-span-2">
              <label class="form-label">内容 *</label>
              <textarea
                v-model="formData.content"
                class="form-textarea"
                rows="5"
                placeholder="请输入公告内容"
              />
            </div>

            <!-- 标签 -->
            <div class="form-item">
              <label class="form-label">标签</label>
              <select v-model="formData.tag" class="form-select">
                <option v-for="tag in tagOptions" :key="tag" :value="tag">
                  {{ tag }}
                </option>
              </select>
            </div>

            <!-- 类型 -->
            <div class="form-item">
              <label class="form-label">类型</label>
              <select v-model="formData.tagType" class="form-select">
                <option v-for="opt in tagTypeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- 置顶 -->
            <div class="form-item col-span-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="formData.pinned"
                  type="checkbox"
                  class="form-checkbox"
                />
                <span class="form-label mb-0">置顶公告</span>
              </label>
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
/* 复用入口管理的样式 */
.announcements-manage {
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

.status-success {
  background: #ecfdf5;
  color: #059669;
}

.status-warning {
  background: #fff7ed;
  color: #ea580c;
}

.status-info {
  background: #eff6ff;
  color: #2563eb;
}

.status-error {
  background: #fef2f2;
  color: #dc2626;
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
  max-width: 700px;
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
</style>
