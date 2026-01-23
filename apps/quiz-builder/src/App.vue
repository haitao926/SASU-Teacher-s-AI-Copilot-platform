<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'
import AnswerSheetDesigner from './components/AnswerSheetDesigner.vue'

const token = useStorage('iai-token', '')
const tenantId = useStorage('iai-tenant', 'default')
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes'

// Navigation State: 'dashboard' | 'quiz-gen' | 'answer-sheet'
const currentView = ref('dashboard')

// Quiz Gen State
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
  <div class="app-container">
    <!-- Top Global Header -->
    <header class="global-header no-print">
      <div class="brand">
        <div class="logo-box">
          <Icon icon="mdi:file-document-edit" width="24" />
        </div>
        <div class="titles">
          <span class="main-title">AI 试卷工作台</span>
          <span class="sub-title">Intelligent Assessment Platform</span>
        </div>
      </div>
      <div class="actions">
        <button v-if="currentView !== 'dashboard'" @click="currentView = 'dashboard'" class="nav-btn">
          <Icon icon="mdi:view-grid-outline" /> 工作台首页
        </button>
        <a :href="appendTokenToUrl('http://localhost:5173')" target="_blank" class="nav-btn outline">
          <Icon icon="mdi:home-export-outline" /> 返回门户
        </a>
      </div>
    </header>

    <!-- DASHBOARD VIEW -->
    <div v-if="currentView === 'dashboard'" class="dashboard fade-in">
      <div class="hero-section">
        <h1>欢迎使用 AI 试卷工作台</h1>
        <p>请选择您需要的功能模块</p>
      </div>
      
      <div class="cards-grid">
        <!-- Card 1: Quiz Generator -->
        <div class="tool-card" @click="currentView = 'quiz-gen'">
          <div class="card-icon blue">
            <Icon icon="mdi:creation" width="48" />
          </div>
          <div class="card-content">
            <h3>智能组卷</h3>
            <p>基于知识点和难度，利用 AI 快速生成试卷结构与题目草稿。</p>
          </div>
          <div class="card-action">
            进入 <Icon icon="mdi:arrow-right" />
          </div>
        </div>

        <!-- Card 2: Answer Sheet -->
        <div class="tool-card" @click="currentView = 'answer-sheet'">
          <div class="card-icon green">
            <Icon icon="mdi:card-account-details-outline" width="48" />
          </div>
          <div class="card-content">
            <h3>答题卡制作</h3>
            <p>可视化设计答题卡，支持二维码与手写识别，一键批量打印。</p>
          </div>
          <div class="card-action">
            进入 <Icon icon="mdi:arrow-right" />
          </div>
        </div>
      </div>
    </div>

    <!-- APP VIEWS -->
    <div v-else class="app-view fade-in">
      
      <!-- Quiz Generator View -->
      <div v-if="currentView === 'quiz-gen'" class="quiz-workspace">
        <div class="panel settings-panel">
          <div class="panel-header">
            <Icon icon="mdi:tune-variant" /> 生成配置
          </div>
          <div class="form-stack">
            <div class="form-group">
              <label>主题/场景</label>
              <input class="input" v-model="topic" />
            </div>
            <div class="form-group">
              <label>知识点 (逗号分隔)</label>
              <textarea class="input" v-model="knowledge" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>难度</label>
              <select class="input" v-model="difficulty">
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>
            <button class="primary-btn full" @click="generate" :disabled="loading">
              <Icon icon="mdi:sparkles" /> {{ loading ? 'AI 生成中...' : '开始生成' }}
            </button>
            <div v-if="message" class="status-msg">{{ message }}</div>
          </div>
        </div>

        <div class="panel preview-panel">
          <div class="panel-header">
            <Icon icon="mdi:file-eye-outline" /> 试卷预览
          </div>
          <div class="preview-content">
            <pre v-if="result">{{ JSON.stringify(result, null, 2) }}</pre>
            <div v-else class="empty-placeholder">
              <Icon icon="mdi:text-box-search-outline" width="48" />
              <p>左侧配置并点击生成后，在此处预览结果</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Answer Sheet Designer View -->
      <AnswerSheetDesigner v-if="currentView === 'answer-sheet'" />

    </div>
  </div>
</template>

<style>
/* Global Resets for this App */
body { margin: 0; font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; }
* { box-sizing: border-box; }

.app-container {
  display: flex; flex-direction: column; height: 100vh;
}

/* Header */
.global-header {
  height: 60px; background: #fff; border-bottom: 1px solid #e2e8f0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; flex-shrink: 0; z-index: 10;
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo-box { 
  width: 36px; height: 36px; background: #0f172a; color: #fff; 
  border-radius: 8px; display: grid; place-items: center; 
}
.titles { display: flex; flex-direction: column; }
.main-title { font-weight: 700; font-size: 16px; line-height: 1.2; }
.sub-title { font-size: 11px; color: #64748b; font-weight: 500; }

.actions { display: flex; gap: 10px; }
.nav-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: 1px solid transparent;
  background: #f1f5f9; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; text-decoration: none;
}
.nav-btn:hover { background: #e2e8f0; color: #0f172a; }
.nav-btn.outline { background: transparent; border-color: #e2e8f0; }
.nav-btn.outline:hover { border-color: #cbd5e1; }

/* Dashboard */
.dashboard {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px;
}
.hero-section { text-align: center; margin-bottom: 48px; }
.hero-section h1 { font-size: 32px; margin: 0 0 12px 0; color: #0f172a; }
.hero-section p { font-size: 16px; color: #64748b; margin: 0; }

.cards-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 340px)); gap: 24px;
  width: 100%; max-width: 800px;
}
.tool-card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  padding: 24px; cursor: pointer; transition: all 0.3s ease;
  display: flex; flex-direction: column; gap: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-color: #cbd5e1;
}
.card-icon {
  width: 64px; height: 64px; border-radius: 12px;
  display: grid; place-items: center;
}
.card-icon.blue { background: #eff6ff; color: #3b82f6; }
.card-icon.green { background: #f0fdf4; color: #22c55e; }

.card-content h3 { margin: 0 0 8px 0; font-size: 18px; }
.card-content p { margin: 0; font-size: 14px; color: #64748b; line-height: 1.5; }
.card-action {
  margin-top: auto; padding-top: 16px; border-top: 1px solid #f1f5f9;
  color: #0f172a; font-weight: 600; font-size: 14px;
  display: flex; align-items: center; gap: 4px;
}

/* App View Wrapper */
.app-view { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* Quiz Workspace (Legacy layout simplified) */
.quiz-workspace {
  display: flex; gap: 20px; padding: 20px; height: 100%; max-width: 1200px; margin: 0 auto; width: 100%;
}
.panel { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
.panel-header {
  padding: 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; display: flex; align-items: center; gap: 8px;
}
.settings-panel { width: 320px; flex-shrink: 0; }
.preview-panel { flex: 1; overflow: hidden; }
.preview-content { flex: 1; overflow: auto; padding: 20px; background: #f8fafc; }
.form-stack { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #475569; }
.input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 14px; }
.primary-btn {
  background: #3b82f6; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;
  display: flex; justify-content: center; align-items: center; gap: 8px;
}
.primary-btn:hover { background: #2563eb; }
.empty-placeholder { text-align: center; color: #94a3b8; margin-top: 60px; }

/* Fade In */
.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media print {
  .no-print { display: none !important; }
  .app-container { height: auto; overflow: visible; }
  .app-view { height: auto; overflow: visible; }
}
</style>
