<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { Group } from '@/types'

const groups = ref<Group[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const currentItem = ref<Group | null>(null)
const isEditing = ref(false)

const formData = ref<Partial<Group>>({
  id: '',
  name: '',
  icon: 'mdi:folder',
  order: 0
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await fetch('/config/entries.json')
    const data = await res.json()
    groups.value = data.groups || []
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

loadData()

// 打开新增对话框
function openAddDialog() {
  isEditing.value = false
  currentItem.value = null
  formData.value = {
    id: `group-${Date.now()}`,
    name: '',
    icon: 'mdi:folder',
    order: groups.value.length + 1
  }
  dialogVisible.value = true
}

// 打开编辑对话框
function openEditDialog(item: Group) {
  isEditing.value = true
  currentItem.value = item
  formData.value = { ...item }
  dialogVisible.value = true
}

// 保存
function handleSave() {
  if (!formData.value.name) {
    alert('请填写分组名称')
    return
  }

  if (isEditing.value && currentItem.value) {
    // 编辑
    const index = groups.value.findIndex(g => g.id === currentItem.value!.id)
    if (index !== -1) {
      groups.value[index] = formData.value as Group
    }
  } else {
    // 新增
    groups.value.push(formData.value as Group)
  }

  groups.value.sort((a, b) => a.order - b.order)
  dialogVisible.value = false
  alert('保存成功！请记得同步更新 entries.json 文件中的 groups 数组')
}

// 删除
function handleDelete(item: Group) {
  if (confirm(`确定删除"${item.name}"吗？\n注意：删除分组后，属于该分组的入口将无法显示！`)) {
    const index = groups.value.findIndex(g => g.id === item.id)
    if (index !== -1) {
      groups.value.splice(index, 1)
      alert('删除成功！请记得同步更新 entries.json 文件')
    }
  }
}

// 上移
function moveUp(index: number) {
  if (index > 0) {
    const temp = groups.value[index]
    groups.value[index] = groups.value[index - 1]!
    groups.value[index - 1] = temp!
    // 更新 order
    groups.value.forEach((g, i) => g.order = i + 1)
  }
}

// 下移
function moveDown(index: number) {
  if (index < groups.value.length - 1) {
    const temp = groups.value[index]
    groups.value[index] = groups.value[index + 1]!
    groups.value[index + 1] = temp!
    // 更新 order
    groups.value.forEach((g, i) => g.order = i + 1)
  }
}

// 常用图标
const iconOptions = [
  'mdi:school',
  'mdi:presentation',
  'mdi:book-open-variant',
  'mdi:clipboard-check',
  'mdi:chart-line',
  'mdi:bell',
  'mdi:folder',
  'mdi:cog',
  'mdi:account-group',
  'mdi:calendar',
]
</script>

<template>
  <div class="groups-manage">
    <!-- 操作栏 -->
    <div class="action-bar">
      <div>
        <h3 class="text-lg font-semibold text-gray-900">分组列表</h3>
        <p class="text-sm text-gray-500 mt-1">管理左侧导航的分组分类</p>
      </div>
      <button class="btn btn-primary" @click="openAddDialog">
        <Icon icon="mdi:plus" class="w-4 h-4" />
        新增分组
      </button>
    </div>

    <!-- 数据表格 -->
    <div class="data-table">
      <table>
        <thead>
          <tr>
            <th width="80">排序</th>
            <th width="80">图标</th>
            <th width="150">ID</th>
            <th>名称</th>
            <th width="200">操作</th>
          </tr>
        </thead>
        <tbody v-if="!loading">
          <tr v-for="(item, index) in groups" :key="item.id">
            <td class="text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  class="btn-icon-sm"
                  :disabled="index === 0"
                  @click="moveUp(index)"
                >
                  <Icon icon="mdi:arrow-up" class="w-4 h-4" />
                </button>
                <span class="text-sm font-medium">{{ item.order }}</span>
                <button
                  class="btn-icon-sm"
                  :disabled="index === groups.length - 1"
                  @click="moveDown(index)"
                >
                  <Icon icon="mdi:arrow-down" class="w-4 h-4" />
                </button>
              </div>
            </td>
            <td class="text-center">
              <Icon :icon="item.icon" class="w-6 h-6 text-primary mx-auto" />
            </td>
            <td class="text-sm text-gray-500 font-mono">{{ item.id }}</td>
            <td class="font-medium">{{ item.name }}</td>
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
            <td colspan="5" class="text-center py-8 text-gray-500">
              <Icon icon="mdi:loading" class="w-6 h-6 animate-spin inline-block" />
              加载中...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑对话框 -->
    <div v-if="dialogVisible" class="dialog-overlay" @click.self="dialogVisible = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">{{ isEditing ? '编辑分组' : '新增分组' }}</h3>
          <button class="dialog-close" @click="dialogVisible = false">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-grid">
            <!-- 名称 -->
            <div class="form-item col-span-2">
              <label class="form-label">分组名称 *</label>
              <input
                v-model="formData.name"
                type="text"
                class="form-input"
                placeholder="例如：教学流程"
              />
            </div>

            <!-- ID -->
            <div class="form-item">
              <label class="form-label">ID（唯一标识）*</label>
              <input
                v-model="formData.id"
                type="text"
                class="form-input"
                placeholder="例如：teaching-flow"
                :disabled="isEditing"
              />
            </div>

            <!-- 排序 -->
            <div class="form-item">
              <label class="form-label">排序</label>
              <input
                v-model.number="formData.order"
                type="number"
                class="form-input"
                min="1"
              />
            </div>

            <!-- 图标 -->
            <div class="form-item col-span-2">
              <label class="form-label">图标</label>
              <div class="icon-grid">
                <button
                  v-for="icon in iconOptions"
                  :key="icon"
                  class="icon-option"
                  :class="{ active: formData.icon === icon }"
                  @click="formData.icon = icon"
                >
                  <Icon :icon="icon" class="w-6 h-6" />
                </button>
              </div>
              <input
                v-model="formData.icon"
                type="text"
                class="form-input mt-2"
                placeholder="或输入自定义图标名称"
              />
              <p class="text-xs text-gray-500 mt-1">
                图标来自 Material Design Icons，查看更多：
                <a href="https://icon-sets.iconify.design/mdi/" target="_blank" class="text-primary">
                  iconify.design/mdi
                </a>
              </p>
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
.groups-manage {
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

.btn-icon-sm {
  padding: 4px;
  color: var(--gray-500);
  transition: all var(--transition-base);
  border-radius: var(--radius-sm);
}

.btn-icon-sm:hover:not(:disabled) {
  background: var(--gray-100);
  color: var(--primary);
}

.btn-icon-sm:disabled {
  opacity: 0.3;
  cursor: not-allowed;
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
  max-width: 600px;
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

.form-input {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  font-size: 14px;
  outline: none;
  transition: all var(--transition-base);
}

.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background: var(--gray-50);
  cursor: not-allowed;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--spacing-2);
}

.icon-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-lg);
  color: var(--gray-600);
  transition: all var(--transition-base);
  cursor: pointer;
}

.icon-option:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--gray-50);
}

.icon-option.active {
  border-color: var(--primary);
  background: var(--primary);
  color: white;
}
</style>
