<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

interface Resource {
  id: string
  title: string
  summary?: string
  type: string
  tags?: string[]
  content?: string
  visibility: 'PRIVATE' | 'INTERNAL' | 'PUBLIC'
  contentUrl?: string
  updatedAt: string
}

const { token, hasPermission } = useAuth()
const canManageAssets = computed(() => hasPermission('assets.manage_all'))
const resources = ref<Resource[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchQuery = ref('')
const filterType = ref('ALL')
const filterVisibility = ref('ALL')

const formData = ref({
  title: '',
  summary: '',
  type: 'file',
  tags: '',
  visibility: 'PRIVATE',
  contentUrl: '',
  content: ''
})

async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value)
    })
    if (searchQuery.value) params.append('keyword', searchQuery.value)
    if (filterType.value !== 'ALL') params.append('type', filterType.value)
    if (filterVisibility.value !== 'ALL') params.append('visibility', filterVisibility.value)

    const res = await fetch(`/api/assets?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!res.ok) throw new Error('加载失败')
    const data = await res.json()
    resources.value = data.items
    total.value = data.total
  } catch (e) {
    console.error(e)
    alert('加载资源失败')
  } finally {
    loading.value = false
  }
}

loadData()

const filtered = computed(() => {
  if (!searchQuery.value) return resources.value
  const q = searchQuery.value.toLowerCase()
  return resources.value.filter(r =>
    r.title.toLowerCase().includes(q) ||
    (r.summary || '').toLowerCase().includes(q)
  )
})

function openAddDialog() {
  if (!canManageAssets.value) {
    alert('无权限新增资源')
    return
  }
  isEditing.value = false
  editingId.value = null
  formData.value = {
    title: '',
    summary: '',
    type: 'file',
    tags: '',
    visibility: 'PRIVATE',
    contentUrl: '',
    content: ''
  }
  dialogVisible.value = true
}

function openEditDialog(item: Resource) {
  if (!canManageAssets.value) return
  isEditing.value = true
  editingId.value = item.id
  formData.value = {
    title: item.title,
    summary: item.summary || '',
    type: item.type || 'file',
    tags: item.tags?.join(',') || '',
    visibility: item.visibility || 'PRIVATE',
    contentUrl: item.contentUrl || '',
    content: item.content || ''
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!formData.value.title) {
    alert('请填写标题')
    return
  }
  if (!formData.value.content && !formData.value.contentUrl) {
    alert('请至少填写内容或资源链接')
    return
  }

  const url = isEditing.value ? `/api/assets/${editingId.value}` : '/api/assets'
  const method = isEditing.value ? 'PUT' : 'POST'
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        ...formData.value,
        tags: formData.value.tags.split(',').map(t => t.trim()).filter(Boolean)
      })
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

async function handleDelete(item: Resource) {
  if (!confirm(`确定删除资源 "${item.title}" ?`)) return
  try {
    const res = await fetch(`/api/assets/${item.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token.value}` }
    })
    if (!res.ok) throw new Error('删除失败')
    await loadData()
  } catch (e) {
    alert('删除失败')
  }
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
  <div class="resources">
    <div class="action-bar">
      <div class="filters">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索标题/摘要..."
            class="search-input"
            @keyup.enter="page = 1; loadData()"
          />
        </div>
        <select v-model="filterType" class="form-select w-32" @change="page = 1; loadData()">
          <option value="ALL">全部类型</option>
          <option value="file">文件</option>
          <option value="markdown">Markdown</option>
          <option value="video">视频</option>
        </select>
        <select v-model="filterVisibility" class="form-select w-32" @change="page = 1; loadData()">
          <option value="ALL">全部可见性</option>
          <option value="PRIVATE">私有</option>
          <option value="INTERNAL">内部</option>
          <option value="PUBLIC">公开</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="openAddDialog">
        <Icon icon="mdi:plus" class="w-4 h-4" />
        新建资源
      </button>
    </div>

    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th width="60">#</th>
            <th width="220">标题</th>
            <th>摘要</th>
            <th width="100">类型</th>
            <th width="120">可见性</th>
            <th width="180">更新时间</th>
            <th width="120">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(item, index) in filtered" :key="item.id">
            <td>{{ (page - 1) * pageSize + index + 1 }}</td>
            <td class="font-medium">{{ item.title }}</td>
            <td class="text-gray-600 text-sm truncate max-w-lg">{{ item.summary }}</td>
            <td><span class="badge">{{ item.type }}</span></td>
            <td><span class="badge badge-gray">{{ item.visibility }}</span></td>
            <td class="text-sm text-gray-500">{{ formatDate(item.updatedAt) }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn-icon" title="编辑" @click="openEditDialog(item)" :disabled="!canManageAssets">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />
                </button>
                <button class="btn-icon text-red-600" title="删除" @click="handleDelete(item)" :disabled="!canManageAssets">
                  <Icon icon="mdi:delete" class="w-4 h-4" />
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
        <Icon icon="mdi:folder-open" class="w-12 h-12 text-gray-300 mb-2" />
        <p class="text-gray-500">暂无资源</p>
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
          <h3 class="dialog-title">{{ isEditing ? '编辑资源' : '新建资源' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">标题 *</label>
              <input v-model="formData.title" class="form-input" placeholder="资源标题" />
            </div>
            <div class="form-item">
              <label class="form-label">摘要</label>
              <textarea v-model="formData.summary" class="form-input" rows="2" placeholder="简短描述" />
            </div>
            <div class="form-row">
              <div class="form-item">
                <label class="form-label">类型</label>
                <select v-model="formData.type" class="form-select">
                  <option value="file">文件</option>
                  <option value="markdown">Markdown</option>
                  <option value="video">视频</option>
                  <option value="audio">音频</option>
                </select>
              </div>
              <div class="form-item">
                <label class="form-label">可见性</label>
                <select v-model="formData.visibility" class="form-select">
                  <option value="PRIVATE">私有</option>
                  <option value="INTERNAL">内部</option>
                  <option value="PUBLIC">公开</option>
                </select>
              </div>
            </div>
            <div class="form-item">
              <label class="form-label">标签（逗号分隔）</label>
              <input v-model="formData.tags" class="form-input" placeholder="数学,高一,必修一" />
            </div>
            <div class="form-item">
              <label class="form-label">内容链接</label>
              <input v-model="formData.contentUrl" class="form-input" placeholder="http(s)://..." />
            </div>
            <div class="form-item">
              <label class="form-label">文本内容（可选）</label>
              <textarea v-model="formData.content" class="form-input" rows="3" placeholder="存储 Markdown 或摘要内容" />
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="dialogVisible = false">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resources {
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
  background: #eef2ff;
  color: #4338ca;
  border-radius: var(--radius-md);
  font-size: 12px;
}
.badge-gray {
  background: #f8fafc;
  color: #475569;
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
  max-width: 560px;
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
