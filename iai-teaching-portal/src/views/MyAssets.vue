<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuth } from '@/composables/useAuth'

interface AssetView {
  id: string
  title: string
  summary?: string | null
  content?: string | null
  contentUrl?: string | null
  metadata?: Record<string, unknown> | null
  type: string
  tags: string[]
  visibility: string
  updatedAt: string
  createdAt: string
}

const { isAdmin } = useAuth()

const searchQuery = ref('')
const mineOnly = ref(true)
const filterVisibility = ref<'ALL' | 'PRIVATE' | 'INTERNAL' | 'PUBLIC'>('ALL')
const filterType = ref('ALL')

const assets = ref<AssetView[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

const dialogOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const formData = ref({
  title: '',
  summary: '',
  content: '',
  contentUrl: '',
  type: 'note',
  visibility: 'PRIVATE',
  tags: ''
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function normalizeTags(raw: string) {
  return raw
    .split(/[,， ]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

async function loadAssets() {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
      mine: mineOnly.value ? 'true' : 'false'
    })
    if (searchQuery.value.trim()) params.set('keyword', searchQuery.value.trim())
    if (filterType.value !== 'ALL') params.set('type', filterType.value)
    if (filterVisibility.value !== 'ALL') params.set('visibility', filterVisibility.value)

    const res = await fetch(`/api/assets?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `加载失败 (${res.status})`)
    }
    const data = await res.json()
    assets.value = data.items || []
    total.value = data.total || 0
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEditing.value = false
  editingId.value = null
  formData.value = {
    title: '',
    summary: '',
    content: '',
    contentUrl: '',
    type: 'note',
    visibility: 'PRIVATE',
    tags: ''
  }
  dialogOpen.value = true
}

function openEdit(asset: AssetView) {
  isEditing.value = true
  editingId.value = asset.id
  formData.value = {
    title: asset.title,
    summary: asset.summary ?? '',
    content: asset.content ?? '',
    contentUrl: asset.contentUrl ?? '',
    type: asset.type,
    visibility: asset.visibility,
    tags: (asset.tags ?? []).join(', ')
  }
  dialogOpen.value = true
}

async function saveAsset() {
  if (!formData.value.title.trim()) {
    alert('请填写标题')
    return
  }
  if (!formData.value.content.trim() && !formData.value.contentUrl.trim()) {
    alert('content 或 contentUrl 至少提供一项')
    return
  }
  saving.value = true
  try {
    const payload = {
      title: formData.value.title.trim(),
      summary: formData.value.summary.trim() || undefined,
      content: formData.value.content.trim() || undefined,
      contentUrl: formData.value.contentUrl.trim() || undefined,
      type: formData.value.type,
      visibility: formData.value.visibility,
      tags: normalizeTags(formData.value.tags)
    }

    const url = isEditing.value ? `/api/assets/${editingId.value}` : '/api/assets'
    const method = isEditing.value ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '保存失败')
    }
    dialogOpen.value = false
    await loadAssets()
  } catch (e: any) {
    alert(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeAsset(asset: AssetView) {
  if (!confirm(`确定删除资源「${asset.title}」？`)) return
  try {
    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '删除失败')
    }
    await loadAssets()
  } catch (e: any) {
    alert(e.message || '删除失败')
  }
}

function goPage(next: number) {
  const p = Math.min(Math.max(1, next), totalPages.value)
  if (p !== page.value) {
    page.value = p
    loadAssets()
  }
}

let debounceTimer: number | undefined
watch(searchQuery, () => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    page.value = 1
    loadAssets()
  }, 300)
})

watch([mineOnly, filterVisibility, filterType], () => {
  page.value = 1
  loadAssets()
})

onMounted(() => {
  loadAssets()
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader v-model:search-query="searchQuery" />

    <main class="pt-24 px-6 pb-10">
      <div class="max-w-6xl mx-auto">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Icon icon="mdi:folder-multiple-outline" class="w-7 h-7 text-primary" />
              我的资源库
            </h1>
            <p class="text-sm text-slate-500 mt-1">统一资产 API：`/api/assets`（支持标签、可见性、跨微应用复用）</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <label class="text-sm text-slate-600 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
              <input type="checkbox" v-model="mineOnly" />
              仅看我创建的
            </label>
            <select v-model="filterType" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm">
              <option value="ALL">全部类型</option>
              <option value="note">笔记</option>
              <option value="courseware">课件</option>
              <option value="pptx">PPTX</option>
              <option value="docx">DOCX</option>
              <option value="pdf">PDF</option>
              <option value="markdown">Markdown</option>
              <option value="quiz-json">试卷</option>
              <option value="image">图片</option>
              <option value="file">文件</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
            </select>
            <select v-model="filterVisibility" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm">
              <option value="ALL">全部可见性</option>
              <option value="PRIVATE">私有</option>
              <option value="INTERNAL">内部</option>
              <option value="PUBLIC">公开</option>
            </select>
            <button class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm" @click="openCreate">
              <Icon icon="mdi:plus" class="w-4 h-4 inline-block mr-1" />
              新建资源
            </button>
          </div>
        </div>

        <div v-if="loading" class="p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
          <Icon icon="mdi:loading" class="w-6 h-6 inline-block animate-spin mr-2" />
          加载中...
        </div>
        <div v-else-if="error" class="p-10 text-center text-rose-600 bg-white rounded-3xl border border-rose-200">
          <Icon icon="mdi:alert-circle-outline" class="w-6 h-6 inline-block mr-2" />
          {{ error }}
        </div>
        <div v-else-if="assets.length === 0" class="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
          <Icon icon="mdi:folder-open" class="w-12 h-12 inline-block mb-3 text-slate-300" />
          <div>暂无资源</div>
          <button class="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm" @click="openCreate">
            立即创建
          </button>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="asset in assets" :key="asset.id" class="bg-white rounded-3xl border border-slate-200 p-5 hover:shadow-md transition">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-2xl bg-slate-100 grid place-items-center text-slate-700">
                <Icon icon="mdi:file-document-outline" class="w-6 h-6" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-900 truncate">{{ asset.title }}</div>
                <div class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{{ asset.type }}</span>
                  <span
                    class="px-2 py-0.5 rounded-full"
                    :class="asset.visibility === 'PUBLIC'
                      ? 'bg-emerald-100 text-emerald-700'
                      : asset.visibility === 'INTERNAL'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'"
                  >
                    {{ asset.visibility }}
                  </span>
                  <span class="ml-auto">{{ new Date(asset.updatedAt).toLocaleString() }}</span>
                </div>
                <div v-if="asset.summary" class="text-sm text-slate-600 mt-3 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">
                  {{ asset.summary }}
                </div>
                <div v-if="asset.tags?.length" class="mt-3 flex flex-wrap gap-1">
                  <span v-for="t in asset.tags.slice(0, 6)" :key="t" class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {{ t }}
                  </span>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-end gap-2">
              <button class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm" @click="openEdit(asset)">
                <Icon icon="mdi:pencil" class="w-4 h-4 inline-block mr-1" />
                编辑
              </button>
              <button class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm" @click="removeAsset(asset)">
                <Icon icon="mdi:delete-outline" class="w-4 h-4 inline-block mr-1" />
                删除
              </button>
            </div>
          </div>
        </div>

        <div v-if="total > pageSize" class="mt-6 flex items-center justify-end gap-3">
          <button class="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-sm" @click="goPage(page - 1)" :disabled="page <= 1">
            上一页
          </button>
          <div class="text-sm text-slate-600">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</div>
          <button class="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-sm" @click="goPage(page + 1)" :disabled="page >= totalPages">
            下一页
          </button>
        </div>
      </div>
    </main>

    <!-- Create/Edit Dialog -->
    <div v-if="dialogOpen" class="fixed inset-0 z-[1040] bg-slate-900/50 backdrop-blur-sm" @click.self="dialogOpen = false">
      <div class="mx-auto mt-10 w-[min(900px,92vw)] rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div class="text-base font-bold text-slate-900">{{ isEditing ? '编辑资源' : '新建资源' }}</div>
          <button class="p-2 rounded-lg hover:bg-slate-100 transition" @click="dialogOpen = false">
            <Icon icon="mdi:close" class="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div class="px-6 py-4 max-h-[70vh] overflow-auto">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-700">标题 *</label>
              <input v-model="formData.title" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="资源标题" />
            </div>
            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-700">摘要</label>
              <textarea v-model="formData.summary" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" rows="2" placeholder="简短描述（可选）" />
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">类型</label>
              <select v-model="formData.type" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                <option value="note">笔记</option>
                <option value="courseware">课件</option>
                <option value="pptx">PPTX</option>
                <option value="docx">DOCX</option>
                <option value="pdf">PDF</option>
                <option value="markdown">Markdown</option>
                <option value="quiz-json">试卷</option>
                <option value="image">图片</option>
                <option value="file">文件</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">可见性</label>
              <select v-model="formData.visibility" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                <option value="PRIVATE">私有</option>
                <option value="INTERNAL">内部</option>
                <option value="PUBLIC" :disabled="!isAdmin">公开（仅管理员）</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-700">标签（逗号分隔）</label>
              <input v-model="formData.tags" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="数学, 高一, 必修一" />
            </div>
            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-700">内容链接</label>
              <input v-model="formData.contentUrl" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="http(s)://..." />
            </div>
            <div class="md:col-span-2">
              <label class="text-sm font-medium text-slate-700">文本内容</label>
              <textarea v-model="formData.content" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" rows="6" placeholder="Markdown/文本（可选）" />
              <div class="text-xs text-slate-500 mt-1">提示：创建资源时 content 或 contentUrl 至少提供一项。</div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-sm" @click="dialogOpen = false">取消</button>
          <button class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60" :disabled="saving" @click="saveAsset">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
