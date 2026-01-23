<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

interface AuditOperator {
  id: string
  username: string
  name: string
  role: string
  tenantId: string
}

interface AuditLogItem {
  id: string
  operatorId: string
  operator: AuditOperator | null
  action: string
  resource: string
  resourceId?: string | null
  details: string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

const { token, hasPermission } = useAuth()
const canViewAudit = computed(() => hasPermission('audit.view'))

const loading = ref(false)
const items = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const keyword = ref('')
const operatorId = ref('')
const action = ref('')
const resource = ref('')
const from = ref('')
const to = ref('')

const detailVisible = ref(false)
const current = ref<AuditLogItem | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatOperator(item: AuditLogItem) {
  if (item.operator?.name) return `${item.operator.name}（${item.operator.username}）`
  if (item.operator?.username) return item.operator.username
  return item.operatorId
}

function formatDetails(details: string) {
  if (!details) return ''
  try {
    return JSON.stringify(JSON.parse(details), null, 2)
  } catch {
    return details
  }
}

function openDetails(item: AuditLogItem) {
  current.value = item
  detailVisible.value = true
}

function resetFilters() {
  keyword.value = ''
  operatorId.value = ''
  action.value = ''
  resource.value = ''
  from.value = ''
  to.value = ''
  page.value = 1
  loadData()
}

async function loadData() {
  if (!canViewAudit.value) return
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value)
    })
    if (keyword.value.trim()) params.append('keyword', keyword.value.trim())
    if (operatorId.value.trim()) params.append('operatorId', operatorId.value.trim())
    if (action.value.trim()) params.append('action', action.value.trim())
    if (resource.value.trim()) params.append('resource', resource.value.trim())
    if (from.value) params.append('from', from.value)
    if (to.value) params.append('to', to.value)

    const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token.value}` }
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '加载失败')
    }
    const data = await res.json()
    items.value = data.items || []
    total.value = data.total || 0
  } catch (e: any) {
    console.error(e)
    alert(e.message || '加载审计日志失败')
  } finally {
    loading.value = false
  }
}

function goPage(p: number) {
  const next = Math.min(Math.max(p, 1), totalPages.value)
  if (next === page.value) return
  page.value = next
  loadData()
}

if (!canViewAudit.value) {
  alert('无权限访问审计日志')
} else {
  loadData()
}
</script>

<template>
  <div class="audit">
    <div class="header">
      <div>
        <h2>审计日志</h2>
        <p>用于追踪后台关键操作（导入、修改、删除等）。</p>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" @click="resetFilters">重置</button>
        <button class="btn btn-primary" @click="loadData" :disabled="loading">刷新</button>
      </div>
    </div>

    <div class="filters">
      <input v-model="keyword" class="form-input" placeholder="关键词（operator/resource/details）" @keyup.enter="goPage(1)" />
      <input v-model="operatorId" class="form-input" placeholder="操作者ID（可选）" @keyup.enter="goPage(1)" />
      <input v-model="action" class="form-input" placeholder="动作（如 IMPORT_SCORES）" @keyup.enter="goPage(1)" />
      <input v-model="resource" class="form-input" placeholder="资源（如 Student/Score/Asset）" @keyup.enter="goPage(1)" />
      <input v-model="from" type="datetime-local" class="form-input" title="起始时间" />
      <input v-model="to" type="datetime-local" class="form-input" title="结束时间" />
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th width="160">时间</th>
            <th width="220">操作者</th>
            <th width="140">动作</th>
            <th width="120">资源</th>
            <th width="160">资源ID</th>
            <th width="140">IP</th>
            <th>详情</th>
            <th width="90">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="item in items" :key="item.id">
            <td>{{ formatTime(item.createdAt) }}</td>
            <td>{{ formatOperator(item) }}</td>
            <td>{{ item.action }}</td>
            <td>{{ item.resource }}</td>
            <td class="mono">{{ item.resourceId || '-' }}</td>
            <td class="mono">{{ item.ipAddress || '-' }}</td>
            <td class="truncate" :title="item.details">{{ item.details }}</td>
            <td>
              <button class="btn btn-small" @click="openDetails(item)">查看</button>
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

      <div v-if="!loading && items.length === 0" class="empty-state">
        <Icon icon="mdi:clipboard-check" class="w-12 h-12 text-gray-300 mb-2" />
        <p class="text-gray-500">暂无数据</p>
      </div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <button class="btn btn-secondary" @click="goPage(page - 1)" :disabled="page <= 1">上一页</button>
      <span class="text-sm text-gray-600">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
      <button class="btn btn-secondary" @click="goPage(page + 1)" :disabled="page >= totalPages">下一页</button>
    </div>

    <div v-if="detailVisible" class="dialog-overlay" @click.self="detailVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">日志详情</h3>
          <button class="dialog-close" @click="detailVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>
        <div class="dialog-body" v-if="current">
          <div class="meta">
            <div><span class="k">时间：</span>{{ formatTime(current.createdAt) }}</div>
            <div><span class="k">操作者：</span>{{ formatOperator(current) }}</div>
            <div><span class="k">动作：</span>{{ current.action }}</div>
            <div><span class="k">资源：</span>{{ current.resource }} <span v-if="current.resourceId" class="mono">({{ current.resourceId }})</span></div>
            <div><span class="k">IP：</span><span class="mono">{{ current.ipAddress || '-' }}</span></div>
            <div><span class="k">UA：</span><span class="mono">{{ current.userAgent || '-' }}</span></div>
          </div>
          <pre class="details">{{ formatDetails(current.details) }}</pre>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit {
  background: white;
  border-radius: 12px;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.header h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.header p {
  margin: 4px 0 0 0;
  color: #6b7280;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
}

.filters {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr 0.9fr 0.9fr;
  gap: 10px;
  margin-bottom: 16px;
}

.table-wrapper {
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--gray-50);
}

th {
  text-align: left;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
  border-bottom: 1px solid var(--gray-200);
}

td {
  padding: 12px;
  border-bottom: 1px solid var(--gray-100);
  font-size: 13px;
  color: var(--gray-700);
  vertical-align: top;
}

tr:hover {
  background: var(--gray-50);
}

.truncate {
  max-width: 520px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.empty-state {
  padding: 40px;
  text-align: center;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color);
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

.btn-small {
  padding: 6px 10px;
  font-size: 12px;
  background: var(--gray-100);
  color: var(--gray-700);
}

.form-input {
  padding: 8px 10px;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.dialog {
  background: white;
  border-radius: 12px;
  width: 820px;
  max-width: 95vw;
  max-height: 85vh;
  overflow: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--gray-100);
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--gray-500);
  padding: 4px;
  border-radius: 6px;
}

.dialog-close:hover {
  background: var(--gray-100);
}

.dialog-body {
  padding: 16px 20px;
}

.dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--gray-100);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  font-size: 13px;
  color: var(--gray-700);
  margin-bottom: 12px;
}

.meta .k {
  color: var(--gray-500);
}

.details {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: var(--gray-800);
}

@media (max-width: 1100px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }
  .truncate {
    max-width: 260px;
  }
  .meta {
    grid-template-columns: 1fr;
  }
}
</style>
