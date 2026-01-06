<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'

const token = useStorage('iai-token', '')
const tenantId = useStorage('iai-tenant', 'default')
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes'

const topic = ref('二次函数及应用')
const knowledge = ref('函数性质, 图像, 极值点')
const difficulty = ref('medium')
const result = ref<any>(null)
const loading = ref(false)
const message = ref('')

function appendTokenToUrl(url: string) {
  try {
    const u = new URL(url)
    if (token.value) u.searchParams.set('auth_token', token.value)
    if (tenantId.value) u.searchParams.set('tenant', tenantId.value)
    return u.toString()
  } catch (e) {
    return url
  }
}

async function generate() {
  loading.value = true
  message.value = ''
  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.value ? `Bearer ${token.value}` : '',
        'x-tenant-id': tenantId.value
      },
      body: JSON.stringify({
        topic: topic.value,
        knowledgePoints: knowledge.value.split(/[,，]/).map((v) => v.trim()).filter(Boolean),
        difficulty: difficulty.value,
        outlineOnly: false
      })
    })
    if (!res.ok) throw new Error('生成失败，请检查 token 或后端接口')
    result.value = await res.json()
    message.value = '已生成试卷草稿，可在下方复制/导出'
  } catch (e: any) {
    message.value = e.message || '生成失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const authToken = params.get('auth_token')
  const tenant = params.get('tenant')
  if (authToken) token.value = authToken
  if (tenant) tenantId.value = tenant
})
</script>

<template>
  <div class="container">
    <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;border-radius:12px;background:#dcfce7;display:grid;place-items:center;color:#15803d;">
          <Icon icon="mdi:file-document-edit" width="22" />
        </div>
        <div>
          <div class="badge">
            <Icon icon="mdi:lightbulb-on" /> 微应用 · 智能组卷
          </div>
          <h1 style="margin:6px 0 0;font-size:22px;">按知识点/难度生成试卷草稿</h1>
          <p class="small" style="margin:4px 0 0;">默认直连 BFF `/api/quizzes/generate`（mock），后续可切换题库接口</p>
        </div>
      </div>
      <a :href="appendTokenToUrl('http://localhost:5173')" target="_blank" rel="noreferrer" class="badge" style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;">
        <Icon icon="mdi:view-dashboard" /> 返回门户
      </a>
    </header>

    <div class="card" style="margin-bottom:14px;">
      <div class="section-title">
        <Icon icon="mdi:tune-variant" /> 配置生成参数
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;align-items:end;">
        <div>
          <label>主题/考试场景</label>
          <input class="input" v-model="topic" placeholder="如：函数综合测试" />
        </div>
        <div>
          <label>知识点列表（逗号分隔）</label>
          <input class="input" v-model="knowledge" placeholder="如：二次函数, 取值范围" />
        </div>
        <div>
          <label>难度</label>
          <select class="input" v-model="difficulty">
            <option value="easy">易</option>
            <option value="medium">中</option>
            <option value="hard">难</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button class="primary" @click="generate" :disabled="loading" style="width:160px;height:40px;">
            {{ loading ? '生成中...' : '生成试卷' }}
          </button>
          <span class="small">Portal 跳转会带 auth_token，可直接调用 BFF</span>
        </div>
      </div>
      <p v-if="message" class="small" style="margin-top:10px;color:#0f766e;">{{ message }}</p>
    </div>

    <div class="card">
      <div class="section-title">
        <Icon icon="mdi:file-eye-outline" /> 生成结果（Markdown 片段）
      </div>
      <div v-if="result" class="small" style="margin-bottom:10px;">
        <div>试卷 ID：{{ result.id || 'draft' }} ｜ 题目数：{{ result.questions?.length || 0 }}</div>
        <div>支持导出 MD/Word/PDF：后端可扩展 `POST /api/quizzes/:id/export`</div>
      </div>
      <pre v-if="result">{{ JSON.stringify(result, null, 2) }}</pre>
      <div v-else class="small">尚未生成，输入参数后点击“生成试卷”即可。</div>
    </div>
  </div>
</template>
