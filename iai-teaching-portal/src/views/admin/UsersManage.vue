<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

interface User {
  id: string
  username: string
  name: string
  role: 'ADMIN' | 'TEACHER'
  createdAt: string
}

const { token } = useAuth()
const users = ref<User[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)

const formData = ref({
  username: '',
  name: '',
  password: '',
  role: 'TEACHER' as 'ADMIN' | 'TEACHER'
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    if (res.ok) {
      users.value = await res.json()
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
const searchQuery = ref('')
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.username.toLowerCase().includes(query) ||
    u.name.toLowerCase().includes(query)
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
    role: 'TEACHER'
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
    password: '', // Leave empty to keep unchanged
    role: user.role
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

  try {
    const url = isEditing.value ? `/api/users/${editingId.value}` : '/api/users'
    const method = isEditing.value ? 'PUT' : 'POST'
    
    // Clean up body
    const body: any = {
      name: formData.value.name,
      role: formData.value.role
    }
    if (!isEditing.value) {
      body.username = formData.value.username
      body.password = formData.value.password
    } else {
      if (formData.value.password) {
        body.password = formData.value.password
      }
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

// 删除
async function handleDelete(user: User) {
  if (confirm(`确定删除用户 "${user.username}" (${user.name}) 吗？`)) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      })
      
      if (!res.ok) {
        const err = await res.json()
        alert(err.message || '删除失败')
        return
      }
      
      await loadData()
    } catch (e) {
      alert('删除失败')
    }
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div class="users-manage">
    <!-- Action Bar -->
    <div class="action-bar">
      <div class="search-box">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索用户..."
          class="search-input"
        />
      </div>
      <button class="btn btn-primary" @click="openAddDialog">
        <Icon icon="mdi:account-plus" class="w-4 h-4" />
        新增用户
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
            <th width="200">创建时间</th>
            <th width="120">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(user, index) in filteredUsers" :key="user.id">
            <td>{{ index + 1 }}</td>
            <td class="font-medium">{{ user.username }}</td>
            <td>{{ user.name }}</td>
            <td>
              <span 
                class="role-badge"
                :class="user.role === 'ADMIN' ? 'role-admin' : 'role-teacher'"
              >
                {{ user.role === 'ADMIN' ? '管理员' : '教师' }}
              </span>
            </td>
            <td class="text-gray-500 text-sm">{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn-icon" title="编辑" @click="openEditDialog(user)">
                  <Icon icon="mdi:pencil" class="w-4 h-4" />
                </button>
                <button class="btn-icon text-red-600" title="删除" @click="handleDelete(user)">
                  <Icon icon="mdi:delete" class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr>
            <td colspan="6" class="text-center py-8 text-gray-500">
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
              </select>
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
