<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'

const emit = defineEmits<{
  (e: 'navigate', view: string): void
  (e: 'open-grading'): void
}>()

const token = useStorage('iai-token', '')
const tenantId = useStorage('iai-tenant', 'default')
// Remove /quizzes if present to get base API url
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes').replace('/quizzes', '')

const recentAssets = ref<any[]>([])
const loading = ref(false)

async function fetchRecentAssets() {
  if (!token.value) return
  loading.value = true
  try {
    // Fetch assets of type 'answer-sheet' or 'quiz' (if we had that type)
    const res = await fetch(`${API_BASE}/assets?type=answer-sheet&limit=5&mine=true`, {
      headers: {
        Authorization: `Bearer ${token.value}`,
        'x-tenant-id': tenantId.value
      }
    })
    if (res.ok) {
      const data = await res.json()
      recentAssets.value = data.items || []
    }
  } catch (e) {
    console.error('Failed to load recent assets', e)
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString()
}

onMounted(() => {
  fetchRecentAssets()
})
</script>

<template>
  <div class="dashboard fade-in">
    <div class="hero-section">
      <h1>试卷与评估中心</h1>
      <p>全流程智能化支持：从命题、制卡到阅卷分析</p>
    </div>
    
    <div class="cards-grid">
      <!-- Card 1: Quiz Generator -->
      <div class="tool-card" @click="emit('navigate', 'quiz-gen')">
        <div class="card-icon blue">
          <Icon icon="mdi:creation" width="48" />
        </div>
        <div class="card-content">
          <h3>智能组卷</h3>
          <p>基于知识点图谱，AI 辅助快速生成试卷结构与题目。</p>
        </div>
        <div class="card-action">
          进入 <Icon icon="mdi:arrow-right" />
        </div>
      </div>

      <!-- Card 2: Answer Sheet -->
      <div class="tool-card" @click="emit('navigate', 'answer-sheet')">
        <div class="card-icon green">
          <Icon icon="mdi:card-account-details-outline" width="48" />
        </div>
        <div class="card-content">
          <h3>答题卡设计</h3>
          <p>可视化设计器，一键生成含识别码的标准答题卡。</p>
        </div>
        <div class="card-action">
          进入 <Icon icon="mdi:arrow-right" />
        </div>
      </div>

      <!-- Card 3: Smart Grading (Link to External App) -->
      <div class="tool-card" @click="emit('open-grading')">
        <div class="card-icon purple">
          <Icon icon="mdi:camera-metering-center" width="48" />
        </div>
        <div class="card-content">
          <h3>智能阅卷</h3>
          <p>批量扫描识别答题卡，自动评分与手写内容提取。</p>
        </div>
        <div class="card-action">
          跳转 <Icon icon="mdi:open-in-new" />
        </div>
      </div>
    </div>

    <!-- Recent Projects Section -->
    <div class="recent-section">
      <div class="section-header">
        <h3><Icon icon="mdi:clock-time-four-outline" /> 最近项目</h3>
        <button class="refresh-btn" @click="fetchRecentAssets" :disabled="loading">
          <Icon icon="mdi:refresh" :class="{ 'spin': loading }" />
        </button>
      </div>
      
      <div v-if="loading && recentAssets.length === 0" class="loading-state">
        加载中...
      </div>
      
      <div v-else-if="recentAssets.length > 0" class="assets-list">
        <div v-for="asset in recentAssets" :key="asset.id" class="asset-item">
          <div class="asset-icon">
            <Icon icon="mdi:file-document-outline" />
          </div>
          <div class="asset-info">
            <div class="asset-title">{{ asset.title }}</div>
            <div class="asset-meta">{{ formatDate(asset.updatedAt) }} · {{ asset.type === 'answer-sheet' ? '答题卡模板' : '其他' }}</div>
          </div>
          <button class="asset-action" title="编辑 (暂未实装)">
             <Icon icon="mdi:pencil-outline" />
          </button>
        </div>
      </div>
      
      <div v-else class="empty-state">
        暂无最近编辑记录
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  flex: 1; display: flex; flex-direction: column; align-items: center; 
  padding: 40px; overflow-y: auto;
}
.hero-section { text-align: center; margin-bottom: 40px; }
.hero-section h1 { font-size: 32px; margin: 0 0 12px 0; color: #0f172a; }
.hero-section p { font-size: 16px; color: #64748b; margin: 0; }

.cards-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;
  width: 100%; max-width: 1000px; margin-bottom: 40px;
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
.card-icon.purple { background: #f5f3ff; color: #8b5cf6; }

.card-content h3 { margin: 0 0 8px 0; font-size: 18px; }
.card-content p { margin: 0; font-size: 14px; color: #64748b; line-height: 1.5; }
.card-action {
  margin-top: auto; padding-top: 16px; border-top: 1px solid #f1f5f9;
  color: #0f172a; font-weight: 600; font-size: 14px;
  display: flex; align-items: center; gap: 4px;
}

/* Recent Section */
.recent-section { width: 100%; max-width: 1000px; }
.section-header { 
  display: flex; align-items: center; gap: 8px; margin-bottom: 16px; 
  color: #475569; font-weight: 600; font-size: 14px;
}
.section-header h3 { margin: 0; display: flex; align-items: center; gap: 6px; }
.refresh-btn { border: none; background: transparent; cursor: pointer; color: #94a3b8; padding: 4px; }
.refresh-btn:hover { color: #3b82f6; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }

.assets-list { 
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; 
}
.asset-item {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;
  display: flex; align-items: center; gap: 12px; transition: all 0.2s;
}
.asset-item:hover { border-color: #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.asset-icon { 
  width: 36px; height: 36px; background: #f1f5f9; color: #64748b; 
  border-radius: 6px; display: grid; place-items: center; flex-shrink: 0;
}
.asset-info { flex: 1; min-width: 0; }
.asset-title { font-size: 14px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-meta { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.asset-action { 
  border: none; background: transparent; color: #cbd5e1; cursor: pointer; padding: 4px; 
}
.asset-action:hover { color: #3b82f6; }

.empty-state {
  text-align: center; color: #94a3b8; font-size: 13px; padding: 20px; 
  background: #fff; border-radius: 8px; border: 1px dashed #e2e8f0;
}
</style>
