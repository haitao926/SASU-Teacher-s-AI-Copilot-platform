<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useAuth } from '@/composables/useAuth'

type EventStatRow = { action: string; count: number }
type AppStatRow = { appCode: string; count: number }

type EventsStats = {
  range: { from: string; to: string }
  scope: 'tenant' | 'user'
  total: number
  byAction: EventStatRow[]
  byApp: AppStatRow[]
}

type RecentEvent = {
  id: string
  actorId: string
  actorRole?: string | null
  appCode?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  occurredAt: string
}

const { token, isLoggedIn } = useAuth()

const loading = ref(false)
const error = ref('')
const stats = ref<EventsStats | null>(null)
const recent = ref<RecentEvent[]>([])

const topActions = computed(() => stats.value?.byAction?.slice(0, 8) ?? [])
const topApps = computed(() => stats.value?.byApp?.slice(0, 8) ?? [])

async function load() {
  if (!token.value) return
  loading.value = true
  error.value = ''
  try {
    const [s, r] = await Promise.all([
      fetch('/api/events/stats', { headers: { Authorization: `Bearer ${token.value}` } }),
      fetch('/api/events/recent?limit=30', { headers: { Authorization: `Bearer ${token.value}` } })
    ])

    if (!s.ok) throw new Error('加载统计失败')
    if (!r.ok) throw new Error('加载事件列表失败')

    stats.value = await s.json()
    recent.value = await r.json()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon icon="mdi:chart-timeline-variant" class="w-6 h-6 text-primary" />
          学习数据看板
        </h2>
        <p class="text-sm text-gray-500 mt-1">
          {{ stats?.scope === 'tenant' ? '全校/租户范围' : '个人范围' }} · 最近 7 天事件统计
        </p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <Icon icon="mdi:refresh" class="w-4 h-4" />
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>

    <div v-if="!isLoggedIn" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
      请先登录后查看学习数据看板。
    </div>

    <div v-else>
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {{ error }}
      </div>

      <div v-if="stats && !error" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p class="text-xs text-gray-500">事件总量</p>
          <p class="text-3xl font-bold text-gray-900 mt-2">{{ stats.total }}</p>
          <p class="text-xs text-gray-400 mt-2">范围：{{ stats.range.from.slice(0, 10) }} ~ {{ stats.range.to.slice(0, 10) }}</p>
        </div>
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p class="text-xs text-gray-500">Top Actions</p>
          <ul class="mt-3 space-y-2">
            <li v-for="row in topActions" :key="row.action" class="flex items-center justify-between text-sm">
              <span class="font-mono text-gray-700 truncate">{{ row.action }}</span>
              <span class="text-gray-500">{{ row.count }}</span>
            </li>
          </ul>
        </div>
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p class="text-xs text-gray-500">Top Apps</p>
          <ul class="mt-3 space-y-2">
            <li v-for="row in topApps" :key="row.appCode" class="flex items-center justify-between text-sm">
              <span class="font-mono text-gray-700 truncate">{{ row.appCode }}</span>
              <span class="text-gray-500">{{ row.count }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="recent.length > 0" class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Icon icon="mdi:history" class="w-4 h-4 text-gray-500" />
            最近事件
          </h3>
          <span class="text-xs text-gray-400">{{ recent.length }} 条</span>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-gray-500 border-b">
                <th class="py-2 pr-4">时间</th>
                <th class="py-2 pr-4">应用</th>
                <th class="py-2 pr-4">动作</th>
                <th class="py-2 pr-4">目标</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in recent" :key="e.id" class="border-b last:border-0">
                <td class="py-2 pr-4 whitespace-nowrap text-gray-600">{{ new Date(e.occurredAt).toLocaleString() }}</td>
                <td class="py-2 pr-4 font-mono text-gray-700">{{ e.appCode || '—' }}</td>
                <td class="py-2 pr-4 font-mono text-gray-900">{{ e.action }}</td>
                <td class="py-2 pr-4 font-mono text-gray-600">
                  {{ e.targetType || '—' }}{{ e.targetId ? `:${e.targetId}` : '' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

