<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { PortalUiConfig } from '@/types'
import { useAuth } from '@/composables/useAuth'

const { token, hasPermission } = useAuth()
const canManagePortal = computed(() => hasPermission('portal.manage'))

const loading = ref(false)
const saving = ref(false)

const defaults: PortalUiConfig = {
  homeTitle: '常用应用',
  homeSubtitle: '您收藏的教学工具，触手可及',
  tipsEnabled: true,
  tipsTitle: 'AI 提问小技巧',
  tipsContent: '试着给 AI 一个具体的“身份”，比如“你是一位有20年经验的中学数学老师”，它的回答会更专业哦。'
}

const formData = ref<PortalUiConfig>({ ...defaults })

async function loadData() {
  loading.value = true
  try {
    const res = await fetch('/api/admin/portal/settings', {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HTTP ${res.status}`)
    }
    const data = await res.json()
    formData.value = {
      homeTitle: data.homeTitle ?? defaults.homeTitle,
      homeSubtitle: data.homeSubtitle ?? defaults.homeSubtitle,
      tipsEnabled: typeof data.tipsEnabled === 'boolean' ? data.tipsEnabled : defaults.tipsEnabled,
      tipsTitle: data.tipsTitle ?? defaults.tipsTitle,
      tipsContent: data.tipsContent ?? defaults.tipsContent
    }
  } catch (error: any) {
    console.error('加载配置失败:', error)
    alert(error.message || '加载配置失败，请检查登录状态或后端服务')
  } finally {
    loading.value = false
  }
}

loadData()

function resetToDefaults() {
  if (confirm('确定恢复默认文案吗？')) {
    formData.value = { ...defaults }
  }
}

async function handleSave() {
  if (!canManagePortal.value) {
    alert('无权限保存前台配置')
    return
  }

  saving.value = true
  try {
    const payload = {
      homeTitle: formData.value.homeTitle,
      homeSubtitle: formData.value.homeSubtitle,
      tipsEnabled: formData.value.tipsEnabled,
      tipsTitle: formData.value.tipsTitle,
      tipsContent: formData.value.tipsContent
    }

    const res = await fetch('/api/admin/portal/settings', {
      method: 'PUT',
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
    alert('保存成功')
  } catch (error: any) {
    console.error('保存失败:', error)
    alert(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
    <div class="px-6 py-5 border-b border-slate-200/60 flex items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <Icon icon="mdi:monitor-dashboard" class="w-5 h-5 text-slate-600" />
          <h2 class="text-base font-bold text-slate-900">前台页面配置</h2>
        </div>
        <p class="text-sm text-slate-500 mt-1">
          配置首页文案与 Tips 卡片（生产环境不回退本地硬编码）。
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
          :disabled="saving || loading"
          @click="resetToDefaults"
        >
          恢复默认
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="saving || loading"
          @click="handleSave"
        >
          <span v-if="saving" class="inline-flex items-center gap-2">
            <Icon icon="mdi:loading" class="w-4 h-4 animate-spin" />
            保存中
          </span>
          <span v-else>保存</span>
        </button>
      </div>
    </div>

    <div class="p-6">
      <div v-if="loading" class="py-10 text-center text-slate-500">
        <Icon icon="mdi:loading" class="w-6 h-6 animate-spin inline-block mr-2" />
        加载中...
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">常用应用标题</label>
            <input
              v-model="formData.homeTitle"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="例如：常用应用"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">常用应用副标题</label>
            <input
              v-model="formData.homeSubtitle"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="例如：您收藏的教学工具，触手可及"
            />
          </div>

          <div class="flex items-center gap-2 pt-2">
            <input
              id="tipsEnabled"
              v-model="formData.tipsEnabled"
              type="checkbox"
              class="w-4 h-4 rounded border-slate-300"
            />
            <label for="tipsEnabled" class="text-sm font-semibold text-slate-700">启用 Tips 卡片</label>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Tips 标题</label>
            <input
              v-model="formData.tipsTitle"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="例如：AI 提问小技巧"
              :disabled="!formData.tipsEnabled"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Tips 内容</label>
            <textarea
              v-model="formData.tipsContent"
              rows="6"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-y"
              placeholder="输入 Tips 内容..."
              :disabled="!formData.tipsEnabled"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
