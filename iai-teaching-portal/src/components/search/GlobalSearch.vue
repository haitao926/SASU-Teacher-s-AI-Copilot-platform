<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const modelValue = defineModel<string>({ required: true })
const inputRef = ref<HTMLInputElement>()

function clearSearch() {
  modelValue.value = ''
  inputRef.value?.focus()
}
</script>

<template>
  <div class="global-search relative">
    <div class="relative">
      <Icon
        icon="mdi:magnify"
        class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
      />
      <input
        ref="inputRef"
        v-model="modelValue"
        type="text"
        placeholder="搜索应用、功能或标签..."
        class="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
      />
      <button
        v-if="modelValue"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        @click="clearSearch"
      >
        <Icon icon="mdi:close-circle" class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.global-search input::placeholder {
  color: var(--gray-400);
}
</style>
