<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

interface AssetView {
  id: string
  title: string
  summary?: string | null
  type: string
  tags?: string[]
  visibility: string
  updatedAt?: string
  createdAt?: string
  authorId?: string
  toolId?: string | null
}

const props = withDefaults(
  defineProps<{
    open: boolean
    multiple?: boolean
    title?: string
    hint?: string
    type?: string
  }>(),
  {
    multiple: false,
    title: '选择资源',
    hint: '从资源库中选择一份资料供应用使用'
  }
)

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', assets: AssetView[]): void
}>()

const keyword = ref('')
const filterVisibility = ref<'ALL' | 'PRIVATE' | 'INTERNAL' | 'PUBLIC'>('ALL')
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const assets = ref<AssetView[]>([])

const selectedIds = ref<Set<string>>(new Set())

const selectedAssets = computed(() => assets.value.filter((a) => selectedIds.value.has(a.id)))

function close() {
  emit('update:open', false)
}

function toggleSelection(asset: AssetView) {
  const next = new Set(selectedIds.value)
  const exists = next.has(asset.id)
  if (props.multiple) {
    if (exists) next.delete(asset.id)
    else next.add(asset.id)
  } else {
    next.clear()
    if (!exists) next.add(asset.id)
  }
  selectedIds.value = next
}

function totalPages() {
  return Math.max(1, Math.ceil(total.value / pageSize.value))
}

async function load() {
  if (!props.open) return
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value)
    })
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())
    if (props.type) params.set('type', props.type)
    if (filterVisibility.value !== 'ALL') params.set('visibility', filterVisibility.value)

    const token = typeof window !== 'undefined' ? localStorage.getItem('iai-token') : null
    const res = await fetch(`/api/assets?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })
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

function confirm() {
  const picked = selectedAssets.value
  if (picked.length === 0) return
  emit('confirm', picked)
  close()
}

function goPage(next: number) {
  const p = Math.min(Math.max(1, next), totalPages())
  if (p !== page.value) {
    page.value = p
    load()
  }
}

watch(
  () => props.open,
  (v) => {
    if (!v) return
    page.value = 1
    load()
  }
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[1040] bg-slate-900/50 backdrop-blur-sm" @click.self="close">
    <div class="mx-auto mt-10 w-[min(980px,92vw)] rounded-2xl bg-white shadow-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white grid place-items-center">
            <Icon icon="mdi:folder-search-outline" class="w-6 h-6" />
          </div>
          <div>
            <div class="text-base font-bold text-slate-900">{{ title }}</div>
            <div class="text-xs text-slate-500 mt-0.5">{{ hint }}</div>
          </div>
        </div>

        <button class="p-2 rounded-lg hover:bg-slate-100 transition" @click="close" title="关闭">
          <Icon icon="mdi:close" class="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div class="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
        <div class="relative w-[min(520px,80vw)]">
          <Icon icon="mdi:magnify" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            v-model="keyword"
            class="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="搜索标题/摘要/标签..."
            @keyup.enter="page = 1; load()"
          />
        </div>

        <select
          v-model="filterVisibility"
          class="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"
          @change="page = 1; load()"
        >
          <option value="ALL">全部可见性</option>
          <option value="PRIVATE">私有</option>
          <option value="INTERNAL">内部</option>
          <option value="PUBLIC">公开</option>
        </select>

        <button class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm transition" @click="page = 1; load()">
          <Icon icon="mdi:reload" class="w-4 h-4 inline-block mr-1" />
          刷新
        </button>

        <div class="ml-auto text-xs text-slate-500">
          已选择 {{ selectedAssets.length }} 项
        </div>
      </div>

      <div class="max-h-[65vh] overflow-auto">
        <div v-if="loading" class="p-10 text-center text-slate-500">
          <Icon icon="mdi:loading" class="w-6 h-6 inline-block animate-spin mr-2" />
          加载中...
        </div>
        <div v-else-if="error" class="p-10 text-center text-rose-600">
          <Icon icon="mdi:alert-circle-outline" class="w-6 h-6 inline-block mr-2" />
          {{ error }}
        </div>
        <div v-else-if="assets.length === 0" class="p-10 text-center text-slate-500">
          <Icon icon="mdi:folder-open" class="w-10 h-10 inline-block mb-2 text-slate-300" />
          <div>暂无可用资源</div>
        </div>
        <div v-else class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            v-for="asset in assets"
            :key="asset.id"
            class="text-left p-4 rounded-2xl border transition group"
            :class="selectedIds.has(asset.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
            @click="toggleSelection(asset)"
          >
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-100 grid place-items-center text-slate-700">
                <Icon icon="mdi:file-document-outline" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <div class="font-semibold text-slate-900 truncate">{{ asset.title }}</div>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {{ asset.type }}
                  </span>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full"
                    :class="asset.visibility === 'PUBLIC'
                      ? 'bg-emerald-100 text-emerald-700'
                      : asset.visibility === 'INTERNAL'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'"
                  >
                    {{ asset.visibility }}
                  </span>
                </div>
                <div
                  v-if="asset.summary"
                  class="text-xs text-slate-600 mt-1 overflow-hidden"
                  style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;"
                >
                  {{ asset.summary }}
                </div>
                <div v-if="asset.tags?.length" class="mt-2 flex flex-wrap gap-1">
                  <span v-for="tag in asset.tags.slice(0, 6)" :key="tag" class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {{ tag }}
                  </span>
                </div>
              </div>
              <div class="pt-1">
                <Icon
                  :icon="selectedIds.has(asset.id) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'"
                  class="w-6 h-6"
                  :class="selectedIds.has(asset.id) ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'"
                />
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-slate-200 flex items-center gap-3">
        <button class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition" @click="close">
          取消
        </button>

        <div class="ml-auto flex items-center gap-2">
          <button
            class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition"
            @click="goPage(page - 1)"
            :disabled="page <= 1"
          >
            上一页
          </button>
          <div class="text-xs text-slate-500">第 {{ page }} / {{ totalPages() }} 页（共 {{ total }} 条）</div>
          <button
            class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition"
            @click="goPage(page + 1)"
            :disabled="page >= totalPages()"
          >
            下一页
          </button>
          <button
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50"
            :disabled="selectedAssets.length === 0"
            @click="confirm"
          >
            确认选择
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
