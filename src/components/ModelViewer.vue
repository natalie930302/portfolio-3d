<template>
  <div ref="container" class="viewer-container">
    <div v-if="loading" class="loading">Loading…</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useThreeViewer } from '../composables/useThreeViewer.js'

const props = defineProps({
  url: { type: String, required: true },
  autoRotate: { type: Boolean, default: false },
})

const container = ref(null)
const loading = ref(true)
let viewer = null
let io = null
let rafId = null
let timeoutId = null

function initViewer() {
  loading.value = true
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (!container.value) return
    viewer = useThreeViewer(container.value, props.url, {
      autoRotate: props.autoRotate,
      onLoad: () => {
        requestAnimationFrame(() => { loading.value = false })
      },
    })
    timeoutId = setTimeout(() => { loading.value = false }, 10000)
  })
}

function destroyViewer() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null }
  viewer?.dispose()
  viewer = null
  container.value?.querySelector('canvas')?.remove()
  loading.value = true
}

onMounted(() => {
  io = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        if (!viewer) initViewer()
      } else {
        destroyViewer()
      }
    },
    { rootMargin: '200px' }
  )
  io.observe(container.value)
})

onUnmounted(() => { io?.disconnect(); destroyViewer() })
</script>

<style scoped>
.viewer-container {
  width: 100%; height: 100%;
  position: relative; overflow: hidden;
}
.viewer-container :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.loading {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Mono', monospace; font-size: 0.6rem;
  color: #888; letter-spacing: 0.1em;
  background: rgba(245,245,243,.9);
  pointer-events: none;
}
</style>
