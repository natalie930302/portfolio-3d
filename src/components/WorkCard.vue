<template>
  <div class="work-card" @click="$emit('open', work)">
    <div class="canvas-wrapper">
      <ModelViewer :url="work.url" :auto-rotate="true" />
    </div>
    <div class="card-info">
      <span class="card-name" :title="work.name">{{ work.name }}</span>
      <span class="card-meta">{{ index }} · {{ work.sizeLabel }}</span>
    </div>
    <div class="card-hint">點擊放大</div>
  </div>
</template>

<script setup>
import ModelViewer from './ModelViewer.vue'
defineProps({
  work: Object,
  index: String,
})
defineEmits(['open'])
</script>

<style scoped>
.work-card {
  background: #fff;
  cursor: pointer;
  border: 1px solid #e0e0dc;
  border-radius: 4px;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.work-card:hover {
  border-color: #bbb;
  box-shadow: 0 4px 20px rgba(0,0,0,.07);
}
.canvas-wrapper {
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
}
.card-info {
  padding: 0.85rem 1rem;
  border-top: 1px solid #e0e0dc;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.card-name {
  font-size: 0.88rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta {
  font-size: 0.58rem;
  font-family: 'Space Mono', monospace;
  color: #888;
  white-space: nowrap;
}
.card-hint {
  font-family: 'Space Mono', monospace;
  font-size: 0.56rem;
  color: #888;
  padding: 0 1rem 0.7rem;
  opacity: 0;
  transition: opacity 0.15s;
}
.work-card:hover .card-hint {
  opacity: 1;
}
</style>
