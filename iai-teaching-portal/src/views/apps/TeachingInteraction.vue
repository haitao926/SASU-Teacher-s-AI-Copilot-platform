<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const currentMode = ref('preview') // preview | edit
const content = ref('<h1>欢迎来到交互式课堂</h1><p>点击这里开始编辑...</p>')

</script>

<template>
  <div class="p-8 max-w-6xl mx-auto">
    <header class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <Icon icon="mdi:gesture-tap" class="text-primary" />
        教学交互体验设计
      </h1>
      <div class="flex gap-2 bg-gray-100 p-1 rounded-lg">
        <button 
          @click="currentMode = 'preview'"
          class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="currentMode === 'preview' ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-900'"
        >
          预览模式
        </button>
        <button 
          @click="currentMode = 'edit'"
          class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="currentMode === 'edit' ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-900'"
        >
          编辑代码
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
      <!-- Code Editor -->
      <div v-show="currentMode === 'edit' || currentMode === 'preview'" class="bg-[#1e1e1e] rounded-xl overflow-hidden flex flex-col shadow-lg" :class="{'lg:col-span-1': true, 'hidden lg:flex': currentMode === 'preview'}">
        <div class="bg-[#2d2d2d] px-4 py-2 text-gray-400 text-xs flex justify-between items-center">
          <span>HTML/CSS</span>
          <Icon icon="mdi:code-tags" />
        </div>
        <textarea 
          v-model="content"
          class="flex-1 w-full bg-transparent text-gray-300 p-4 font-mono text-sm resize-none focus:outline-none"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Live Preview -->
      <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col" :class="{'lg:col-span-2': currentMode === 'preview' && false}">
         <div class="bg-gray-50 px-4 py-2 border-b text-gray-500 text-xs flex justify-between items-center">
          <span>实时预览</span>
          <Icon icon="mdi:eye" />
        </div>
        <div class="flex-1 p-6 overflow-auto" v-html="content"></div>
      </div>
    </div>
  </div>
</template>
