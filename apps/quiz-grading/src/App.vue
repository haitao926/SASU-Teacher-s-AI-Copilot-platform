<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useStorage } from '@vueuse/core'

const token = useStorage('iai-token', '')
const tenantId = useStorage('iai-tenant', 'default')
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/grading'

const assignmentName = ref('')
const subject = ref('')
const assignments = ref<any[]>([])
const submissions = ref<any[]>([])
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

async function fetchAssignments() {
  loading.value = true
  message.value = ''
  try {
    const res = await fetch(`${API_BASE}/assignments`, {
      headers: {
        Authorization: token.value ? `Bearer ${token.value}` : '',
        'x-tenant-id': tenantId.value
      }
    })
    assignments.value = res.ok ? await res.json() : []
  } catch (e: any) {
    message.value = e.message || '获取作业列表失败'
  } finally {
    loading.value = false
  }
}

async function createAssignment() {
  if (!assignmentName.value || !subject.value) {
    message.value = '请填写作业名称和学科'
    return
  }
  loading.value = true
  message.value = ''
  try {
    const res = await fetch(`${API_BASE}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.value ? `Bearer ${token.value}` : '',
        'x-tenant-id': tenantId.value
      },
      body: JSON.stringify({ name: assignmentName.value, subject: subject.value })
    })
    if (!res.ok) throw new Error('创建失败，请检查 token 或后端')
    assignmentName.value = ''
    subject.value = ''
    await fetchAssignments()
    message.value = '已创建作业，可以继续上传标准答案或录入成绩'
  } catch (e: any) {
    message.value = e.message || '创建失败'
  } finally {
    loading.value = false
  }
}

async function fetchSubmissions() {
  loading.value = true
  message.value = ''
  try {
    const res = await fetch(`${API_BASE}/submissions`, {
      headers: {
        Authorization: token.value ? `Bearer ${token.value}` : '',
        'x-tenant-id': tenantId.value
      }
    })
    submissions.value = res.ok ? await res.json() : []
  } catch (e: any) {
    message.value = e.message || '获取提交记录失败'
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
  fetchAssignments()
  fetchSubmissions()
})
</script>

<template>
  <div class="container">
    <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;border-radius:12px;background:#eef2ff;display:grid;place-items:center;color:#4f46e5;">
          <Icon icon="mdi:checkbox-marked-outline" width="22" />
        </div>
        <div>
          <div class="badge">
            <Icon icon="mdi:rocket-launch" /> 微应用 · 智能阅卷
          </div>
          <h1 style="margin:6px 0 0;font-size:22px;">上传答案/试卷，自动判分并导出</h1>
          <p class="small" style="margin:4px 0 0;">默认直连 BFF `/api/grading`，可在 VITE_API_BASE 指定网关地址</p>
        </div>
      </div>
      <a :href="appendTokenToUrl('http://localhost:5173')" target="_blank" rel="noreferrer" class="badge" style="background:#ecfeff;color:#0ea5e9;border:1px solid #bae6fd;">
        <Icon icon="mdi:view-dashboard" /> 返回门户
      </a>
    </header>

    <div class="card" style="margin-bottom:14px;">
      <div class="section-title">
        <Icon icon="mdi:form-select" /> 快速创建一个作业/试卷
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:end;">
        <div>
          <label>作业名称</label>
          <input class="input" v-model="assignmentName" placeholder="如：七年级上·期末卷" />
        </div>
        <div>
          <label>学科</label>
          <input class="input" v-model="subject" placeholder="如：数学" />
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button class="primary" @click="createAssignment" :disabled="loading" style="width:140px;height:40px;">
            {{ loading ? '提交中...' : '创建' }}
          </button>
          <span class="small">使用 portal 带入的 auth_token，可免登录调用 BFF</span>
        </div>
      </div>
      <p v-if="message" class="small" style="margin-top:10px;color:#0f766e;">{{ message }}</p>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <div class="section-title">
        <Icon icon="mdi:list-status" /> 作业列表
      </div>
      <div class="list">
        <div v-for="item in assignments" :key="item.id" class="list-item">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <div style="font-weight:700;">{{ item.name }}</div>
              <div class="small">学科：{{ item.subject }} · 状态：{{ item.status }}</div>
            </div>
            <div class="status-pill" :class="item.status?.toLowerCase() || 'processing'">
              {{ item.status || 'PROCESSING' }}
            </div>
          </div>
        </div>
        <div v-if="!assignments.length" class="small">暂无数据，可先创建一个。</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">
        <Icon icon="mdi:account-check-outline" /> 提交记录（含客观题即时判分）
      </div>
      <p class="small" style="margin:0 0 10px;">调用 `/grading/submissions` 即可查看最新提交；导出使用 `/grading/export?assignmentId=`。</p>
      <div class="list">
        <div v-for="s in submissions" :key="s.id" class="list-item">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div>
              <div style="font-weight:700;">{{ s.student?.name || '学生' }} · {{ s.student?.class }}</div>
              <div class="small">学号：{{ s.student?.studentId }} ｜ 状态：{{ s.status }}</div>
              <div class="small">得分：{{ s.totalScore }}</div>
            </div>
            <div class="status-pill" :class="s.status?.toLowerCase() || 'pending'">{{ s.status }}</div>
          </div>
          <div v-if="s.grading" class="small" style="margin-top:6px;">判分详情：{{ s.grading.details }}</div>
        </div>
        <div v-if="!submissions.length" class="small">暂无提交，后续可接入 OCR/拍照上传自动判分。</div>
      </div>
    </div>
  </div>
</template>
