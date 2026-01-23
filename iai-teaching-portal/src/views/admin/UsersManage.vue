<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

type UserStatus = 'ACTIVE' | 'DISABLED' | 'PENDING'

interface User {
  id: string
  username: string
  name: string
  role: 'ADMIN' | 'TEACHER' | 'VIEWER'
  status: UserStatus
  subjects?: string[]
  classes?: string[]
  permissions?: string[]
  lockedUntil?: string | null
  loginFailures?: number
  createdAt: string
  lastLoginAt?: string
}

const { token, hasPermission } = useAuth()
const canManageUsers = computed(() => hasPermission('users.manage'))
if (!canManageUsers.value) {
  alert('无权限访问教职工账号')
}
const users = ref<User[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const formData = ref({
  username: '',
  name: '',
  password: '',
  role: 'TEACHER' as User['role'],
  status: 'ACTIVE' as UserStatus,
  permissions: [] as string[],
  subjects: '',
  classes: ''
})

const roleFilter = ref<'ALL' | User['role']>('ALL')
const statusFilter = ref<'ALL' | UserStatus | 'LOCKED'>('ALL')
const importMessage = ref('')
const searchQuery = ref('')

const now = () => Date.now()
const isLocked = (user: User) => {
  if (!user.lockedUntil) return false
  const until = new Date(user.lockedUntil).getTime()
  return Number.isFinite(until) && until > now()
}

const displayStatus = (user: User) => (isLocked(user) ? 'LOCKED' : user.status)
const formatList = (items?: string[]) => (items && items.length > 0 ? items.join('、') : '—')

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
      keyword: searchQuery.value
    })
    if (roleFilter.value !== 'ALL') params.append('role', roleFilter.value)
    if (statusFilter.value !== 'ALL') params.append('status', statusFilter.value)

    const res = await fetch(`/api/users?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    if (res.ok) {
      const data = await res.json()
      users.value = data.items
      total.value = data.total
    } else {
      console.error('Failed to load users')
    }
  } catch (error) {
    console.error('API Error:', error)
  } finally {
    loading.value = false
  }
}

loadData()

// 搜索
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.username.toLowerCase().includes(query) ||
    u.name.toLowerCase().includes(query) ||
    (u.subjects || []).join(',').toLowerCase().includes(query) ||
    (u.classes || []).join(',').toLowerCase().includes(query)
  )
})

// 打开新增
function openAddDialog() {
  isEditing.value = false
  editingId.value = null
  formData.value = {
    username: '',
    name: '',
    password: '',
    role: 'TEACHER',
    status: 'ACTIVE',
    permissions: [],
    subjects: '',
    classes: ''
  }
  dialogVisible.value = true
}

// 打开编辑
function openEditDialog(user: User) {
  isEditing.value = true
  editingId.value = user.id
  formData.value = {
    username: user.username,
    name: user.name,
    password: '',
    role: user.role,
    status: user.status,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    subjects: (user.subjects || []).join(','),
    classes: (user.classes || []).join(',')
  }
  dialogVisible.value = true
}

// 保存
async function handleSave() {
  if (!formData.value.username || !formData.value.name) {
    alert('请填写必填项')
    return
  }
  if (!isEditing.value && !formData.value.password) {
    alert('新建用户必须设置密码')
    return
  }
  if (!canManageUsers.value) {
    alert('无权限操作教职工账号')
    return
  }

  try {
    const url = isEditing.value ? `/api/users/${editingId.value}` : '/api/users'
    const method = isEditing.value ? 'PUT' : 'POST'

    const subjects = parseListText(formData.value.subjects)
    const classes = parseListText(formData.value.classes)
    const body: any = {
      name: formData.value.name,
      role: formData.value.role,
      status: formData.value.status,
      permissions: formData.value.permissions,
      subjects,
      classes
    }
    if (!isEditing.value) {
      body.username = formData.value.username
      body.password = formData.value.password
    } else if (formData.value.password) {
      body.password = formData.value.password
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.message || '操作失败')
      return
    }

    await loadData()
    dialogVisible.value = false
  } catch (e) {
    console.error(e)
    alert('操作失败')
  }
}

async function handleToggle(user: User) {
  if (isLocked(user)) {
    alert('该账号当前处于锁定状态，请先解锁或重置密码。')
    return
  }
  const targetStatus = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
  const confirmMsg = targetStatus === 'DISABLED'
    ? `确定禁用用户 "${user.username}" (${user.name}) 吗？`
    : `确定启用用户 "${user.username}" 吗？`
  if (!confirm(confirmMsg)) return

  try {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({ status: targetStatus })
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.message || '操作失败')
      return
    }
    await loadData()
  } catch (e) {
    alert('操作失败')
  }
}

async function handleUnlock(user: User) {
  if (!isLocked(user)) return
  if (!confirm(`解锁用户 "${user.username}"？`)) return
  try {
    const res = await fetch(`/api/users/${user.id}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      }
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.message || '解锁失败')
      return
    }
    await loadData()
  } catch (e) {
    alert('解锁失败')
  }
}

async function handleApprove(user: User) {
  if (!confirm(`批准用户 "${user.username}" 激活账号？`)) return
  try {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({ status: 'ACTIVE' })
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.message || '审批失败')
      return
    }
    await loadData()
  } catch (e) {
    alert('审批失败')
  }
}

async function handleResetPassword(user: User) {
  if (!confirm(`重置用户 "${user.username}" 的密码？`)) return
  try {
    const res = await fetch(`/api/users/${user.id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      }
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.message || '重置失败')
      return
    }
    const data = await res.json()
    alert(`重置成功，临时密码：${data.tempPassword}`)
  } catch (e) {
    alert('重置失败')
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

function formatLockedUntil(user: User) {
  if (!isLocked(user)) return ''
  return `锁定至 ${formatDate(user.lockedUntil || undefined)}`
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
function goPage(p: number) {
  const next = Math.min(Math.max(1, p), totalPages.value)
  if (next !== page.value) {
    page.value = next
    loadData()
  }
}

async function exportUsers() {
  const res = await fetch('/api/users/export', {
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
  a.download = 'users.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function downloadTemplate() {
  const sample = 'username,name,role,status,password,subjects,classes\nteacher100,张老师,TEACHER,ACTIVE,,语文|数学,701|702\n'
  const blob = new Blob([sample], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'teachers-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseListText(text?: string) {
  if (!text) return []
  return text
    .split(/[,，;；、|\/]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseDelimited(text: string) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map(h => h.trim())
  const idx = (key: string) => headers.indexOf(key)
  const rows: any[] = []
  const idxSubjects = (() => {
    const keys = ['subjects', '学科', '科目', 'subject', '教学科目']
    for (const key of keys) {
      const found = idx(key)
      if (found !== -1) return found
    }
    return -1
  })()
  const idxClasses = (() => {
    const keys = ['classes', '班级', '班級', 'class', '任教班级']
    for (const key of keys) {
      const found = idx(key)
      if (found !== -1) return found
    }
    return -1
  })()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter)
    const username = cols[idx('username')]?.trim()
    const name = cols[idx('name')]?.trim()
    if (!username || !name) continue
    const entry: any = {
      username,
      name,
      role: cols[idx('role')]?.trim(),
      status: cols[idx('status')]?.trim(),
      password: cols[idx('password')]?.trim()
    }
    if (idxSubjects !== -1) {
      entry.subjects = parseListText(cols[idxSubjects])
    }
    if (idxClasses !== -1) {
      entry.classes = parseListText(cols[idxClasses])
    }
    rows.push(entry)
  }
  return rows
}

async function handleImport(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  importMessage.value = ''
  const file = files[0]
  const text = await file.text()
  const rows = parseDelimited(text)
  if (rows.length === 0) {
    alert('未读取到有效数据，请检查表头与内容')
    return
  }

  try {
    const res = await fetch('/api/users/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({ users: rows })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || '导入失败')
    }
    const data = await res.json()
    importMessage.value = `导入成功：新增 ${data.created}，更新 ${data.updated}` + (data.tempPasswords?.length ? `，自动密码 ${data.tempPasswords.map((p: any) => p.username + ':' + p.password).join('，')}` : '')
    await loadData()
  } catch (error: any) {
    alert(error.message || '导入失败')
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <div class="users-manage">
    <!-- 导入提示 -->
    <div class="import-box">
      <div class="import-actions">
        <div class="text-sm text-gray-600">
          支持 CSV/TSV（表头：username,name,role,status,password,subjects,classes），学科/班级可用逗号或“|”分隔。
        </div>
        <div class="flex gap-3 items-center">
          <button class="btn btn-secondary" @click="downloadTemplate">下载模板</button>
          <label class="btn btn-primary cursor-pointer">
            <input type="file" class="hidden" accept=".csv,.tsv,.txt" @change="handleImport" />
            选择文件导入
          </label>
        </div>
      </div>
      <div v-if="importMessage" class="text-sm text-green-700 mt-2">
        {{ importMessage }}
      </div>
    </div>

    <!-- Action Bar -->
    <div class="action-bar">
      <div class="filters">
        <div class="search-box">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索用户..."
            class="search-input"
            @keyup.enter="page = 1; loadData()"
          />
        </div>
        <select v-model="roleFilter" class="form-select w-32" @change="page = 1; loadData()">
          <option value="ALL">全部角色</option>
          <option value="ADMIN">管理员</option>
          <option value="TEACHER">教师</option>
          <option value="VIEWER">只读</option>
        </select>
        <select v-model="statusFilter" class="form-select w-32" @change="page = 1; loadData()">
          <option value="ALL">全部状态</option>
          <option value="ACTIVE">启用</option>
          <option value="DISABLED">已禁用</option>
          <option value="LOCKED">已锁定</option>
          <option value="PENDING">待审核</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="openAddDialog" :disabled="!canManageUsers">
        <Icon icon="mdi:account-plus" class="w-4 h-4" />
        新增用户
      </button>
      <button class="btn btn-secondary" @click="exportUsers" :disabled="!canManageUsers">
        <Icon icon="mdi:export" class="w-4 h-4" />
        导出 CSV
      </button>
    </div>

    <!-- Data Table -->
    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th width="50">#</th>
            <th width="150">用户名</th>
            <th width="150">姓名</th>
            <th width="100">角色</th>
            <th width="140">学科</th>
            <th width="140">班级</th>
            <th width="100">状态</th>
            <th width="180">上次登录</th>
            <th width="200">创建时间</th>
            <th width="180">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(user, index) in filteredUsers" :key="user.id">
            <td>{{ (page - 1) * pageSize + index + 1 }}</td>
            <td class="font-medium">{{ user.username }}</td>
            <td>{{ user.name }}</td>
            <td>
              <span 
                class="role-badge"
                :class="user.role === 'ADMIN' ? 'role-admin' : 'role-teacher'"
              >
                {{ user.role === 'ADMIN' ? '管理员' : user.role === 'TEACHER' ? '教师' : '只读' }}
              </span>
            </td>
            <td class="text-gray-500 text-sm">{{ formatList(user.subjects) }}</td>
            <td class="text-gray-500 text-sm">{{ formatList(user.classes) }}</td>
            <td>
              <span
                class="status-badge"
                :class="{
                  'status-active': displayStatus(user) === 'ACTIVE',
                  'status-disabled': displayStatus(user) === 'DISABLED',
                  'status-locked': displayStatus(user) === 'LOCKED',
                  'status-pending': displayStatus(user) === 'PENDING'
                }"
                :title="formatLockedUntil(user)"
              >
                {{ displayStatus(user) === 'ACTIVE' ? '启用' : displayStatus(user) === 'DISABLED' ? '已禁用' : displayStatus(user) === 'LOCKED' ? '已锁定' : '待审核' }}
              </span>
            </td>
            <td class="text-gray-500 text-sm">{{ formatDate(user.lastLoginAt) }}</td>
            <td class="text-gray-500 text-sm">{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="flex gap-2">
                <button
                  v-if="displayStatus(user) === 'LOCKED'"
                  class="btn-icon text-indigo-600"
                  title="解锁"
                  @click="handleUnlock(user)"
                  :disabled="!canManageUsers"
                >
                  <Icon icon="mdi:lock-open-variant" class="w-4 h-4" />
                </button>
                <button
                  v-if="displayStatus(user) === 'PENDING'"
                  class="btn-icon text-green-600"
                  title="批准"
                  @click="handleApprove(user)"
                  :disabled="!canManageUsers"
                >
                  <Icon icon="mdi:check-circle" class="w-4 h-4" />
                </button>
                <button class="btn-icon" title="重置密码" @click="handleResetPassword(user)" :disabled="!canManageUsers">
                  <Icon icon="mdi:key-variant" class="w-4 h-4" />
                </button>
                <button class="btn-icon" title="编辑" @click="openEditDialog(user)" :disabled="!canManageUsers">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />
                </button>
                <button
                  class="btn-icon"
                  :class="user.status === 'DISABLED' ? 'text-green-600' : 'text-red-600'"
                  :title="user.status === 'DISABLED' ? '启用' : '禁用'"
                  @click="handleToggle(user)"
                  :disabled="!canManageUsers"
                >
                  <Icon :icon="user.status === 'DISABLED' ? 'mdi:lock-open-variant' : 'mdi:lock-outline'" class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="10" class="text-center py-8 text-gray-500">
              <Icon icon="mdi:loading" class="w-6 h-6 animate-spin inline-block" />
              加载中...
            </td>
          </tr>
        </tbody>
      </table>
      
       <div v-if="!loading && filteredUsers.length === 0" class="empty-state">
        <Icon icon="mdi:account-off-outline" class="w-16 h-16 text-gray-300 mb-2" />
        <p class="text-gray-500">暂无用户</p>
      </div>
    </div>

    <!-- Dialog -->
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ isEditing ? '编辑用户' : '新增用户' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <div class="form-item">
              <label class="form-label">用户名 *</label>
              <input
                v-model="formData.username"
                type="text"
                class="form-input"
                :disabled="isEditing"
                placeholder="登录账号"
              />
            </div>

            <div class="form-item">
              <label class="form-label">姓名 *</label>
              <input
                v-model="formData.name"
                type="text"
                class="form-input"
                placeholder="教师姓名"
              />
            </div>

            <div class="form-item">
              <label class="form-label">角色</label>
              <select v-model="formData.role" class="form-select">
                <option value="TEACHER">教师</option>
                <option value="ADMIN">管理员</option>
                <option value="VIEWER">只读</option>
              </select>
            </div>

            <div class="form-item">
              <label class="form-label">状态</label>
              <select v-model="formData.status" class="form-select">
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">禁用</option>
              </select>
            </div>

            <div class="form-item">
              <label class="form-label">教学科目</label>
              <input
                v-model="formData.subjects"
                type="text"
                class="form-input"
                placeholder="语文,数学"
              />
            </div>

            <div class="form-item">
              <label class="form-label">任教班级</label>
              <input
                v-model="formData.classes"
                type="text"
                class="form-input"
                placeholder="701,702"
              />
            </div>

            <div class="form-item col-span-2">
              <label class="form-label">管理权限（可选）</label>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="portal.manage" v-model="formData.permissions" />
                  前台配置
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="entries.manage" v-model="formData.permissions" />
                  入口/分组
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="announcements.manage" v-model="formData.permissions" />
                  公告管理
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="assets.manage_all" v-model="formData.permissions" />
                  资源库（全局）
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="questions.manage_all" v-model="formData.permissions" />
                  题库（全局）
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="students.manage" v-model="formData.permissions" />
                  学生档案
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="events.view_all" v-model="formData.permissions" />
                  学习数据（全校）
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="audit.view" v-model="formData.permissions" />
                  审计日志
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" value="users.manage" v-model="formData.permissions" />
                  教职工账号
                </label>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                提示：权限变更后需要用户重新登录以刷新 Token。
              </div>
            </div>

            <div class="form-item">
              <label class="form-label">
                密码 
                <span v-if="!isEditing" class="text-red-500">*</span>
                <span v-else class="text-xs text-gray-500 font-normal">(留空保持不变)</span>
              </label>
              <input
                v-model="formData.password"
                type="password"
                class="form-input"
                placeholder="登录密码"
              />
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn btn-secondary" @click="dialogVisible = false">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="total > pageSize">
      <button class="btn btn-secondary" @click="goPage(page - 1)" :disabled="page <= 1">上一页</button>
      <span class="text-sm text-gray-600">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
      <button class="btn btn-secondary" @click="goPage(page + 1)" :disabled="page >= totalPages">下一页</button>
    </div>
  </div>
</template>

<style scoped>
/* Common Styles (copied from AnnouncementsManage for consistency) */
.users-manage {
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
  padding: var(--spacing-4);
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

.import-box {
  padding: var(--spacing-4) var(--spacing-6);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
}
.import-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  flex-wrap: wrap;
}
.filters {
  display: flex;
  gap: var(--spacing-3);
  align-items: center;
}

.role-badge {
  padding: 2px 8px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
}

.role-admin {
  background: #fef3c7;
  color: #d97706;
}

.role-teacher {
  background: #eff6ff;
  color: #2563eb;
}

.status-badge {
  padding: 2px 8px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
}
.status-active {
  background: #ecfdf3;
  color: #16a34a;
}
.status-disabled {
  background: #f8fafc;
  color: #94a3b8;
}
.status-locked {
  background: #fff7ed;
  color: #ea580c;
}
.status-pending {
  background: #eef2ff;
  color: #4f46e5;
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
  transition: all var(--transition-base);
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
  border-radius: var(--radius-md);
  cursor: pointer;
}

.btn-icon:hover {
  background: var(--gray-100);
  color: var(--primary);
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
  padding: var(--spacing-16) 0;
}

/* Dialog */
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
  max-width: 500px;
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
  cursor: pointer;
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

.form-item {
  display: flex;
  flex-direction: column;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-3);
  padding: var(--spacing-4) var(--spacing-6);
}
.form-label {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: var(--spacing-2);
  color: var(--gray-700);
}

.form-input, .form-select {
  padding: 8px 12px;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 14px;
  outline: none;
}

.form-input:focus, .form-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background: var(--gray-50);
  color: var(--gray-500);
}
</style>
