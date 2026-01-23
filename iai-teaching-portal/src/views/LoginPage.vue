<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
    <div class="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.08)] border border-white/50 relative overflow-hidden">
      
      <!-- Decorative background blobs -->
      <div class="absolute -top-10 -right-10 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl"></div>
      <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl"></div>

      <div class="flex flex-col items-center relative z-10">
        <div class="mb-6">
          <img src="/logo.png" alt="Logo" class="h-20 w-auto object-contain drop-shadow-sm invert" />
        </div>
        <h2 class="mt-2 text-center text-3xl font-bold text-slate-800 tracking-tight" style="font-family: 'Outfit', sans-serif;">
          ReOpenInnoLab
        </h2>
        <p class="mt-2 text-center text-sm font-medium text-slate-500 uppercase tracking-widest">
          智教空间 · 教师端
        </p>
        <p class="mt-4 text-center text-sm text-slate-600 max-w-xs leading-relaxed">
          您的全能 AI 教学副驾驶<br>备课 · 命题 · 批改 · 分析
        </p>
      </div>
      
      <form class="mt-8 space-y-6 relative z-10" @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <div v-if="isRegister">
            <label for="name" class="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">姓名</label>
            <input
              id="name"
              name="name"
              type="text"
              v-model="name"
              class="appearance-none block w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              placeholder="请输入姓名"
            />
          </div>
          <div>
            <label for="username" class="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">账号</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              v-model="username"
              class="appearance-none block w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              placeholder="请输入教师工号/用户名"
            />
          </div>
          <div>
            <label for="password" class="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              v-model="password"
              class="appearance-none block w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              placeholder="请输入密码"
            />
          </div>
        </div>

	        <div v-if="error" class="p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center border border-red-100 flex items-center justify-center gap-2 animate-pulse">
	           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
	             <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
	           </svg>
	           {{ error }}
	        </div>
	        <div
	          v-if="error && error.includes('Account locked')"
	          class="text-xs text-slate-500 text-center leading-relaxed"
	        >
	          账号已锁定：请稍后再试；管理员可在后台解锁/重置密码。开发环境可在 <code>bff</code> 目录执行 <code>npm run reset:admin</code>。
	        </div>

        <div>
          <button
            type="submit"
            :disabled="loading"
            class="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
            {{ loading ? (isRegister ? '正在提交...' : '正在验证身份...') : (isRegister ? '提交注册' : '登录系统') }}
          </button>
        </div>

        <div class="text-center">
            <p class="text-xs text-slate-400">
                初次使用或忘记密码？可以 <button type="button" class="text-blue-600 hover:underline" @click="isRegister = !isRegister">{{ isRegister ? '返回登录' : '自助注册' }}</button> 或联系教务信息化中心
            </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const username = ref('')
const password = ref('')
const isRegister = ref(false)
const name = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()
const { login } = useAuth()

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  try {
    if (isRegister.value) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value, password: password.value, name: name.value || username.value })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || '注册失败')
      }
      alert('注册成功，等待管理员审核')
      isRegister.value = false
      password.value = ''
      name.value = ''
    } else {
      await login(username.value, password.value)
      router.push('/')
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
