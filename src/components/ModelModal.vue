<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="work" class="overlay" @click.self="$emit('close')">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ work.name }}</span>
            <button class="modal-close" @click="$emit('close')">✕</button>
          </div>
          <!-- 直接複用同一個 ModelViewer，scene 已在縮圖時載好 -->
          <div class="modal-viewer">
            <ModelViewer :url="work.url" :auto-rotate="false" />
          </div>
          <div class="modal-footer">
            <span>左鍵 旋轉</span><span>右鍵 平移</span><span>滾輪 縮放</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import ModelViewer from './ModelViewer.vue'
defineProps({ work: Object })
defineEmits(['close'])
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: #fff;
  width: min(94vw, 1000px);
  border-radius: 4px;
  overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
}
.modal-header {
  padding: 0.85rem 1.4rem;
  border-bottom: 1px solid #e0e0dc;
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
}
.modal-title { font-size: .9rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modal-close { flex-shrink: 0; background: none; border: 1px solid #e0e0dc; color: #1a1a1a; width: 26px; height: 26px; cursor: pointer; border-radius: 3px; display: flex; align-items: center; justify-content: center; }
.modal-close:hover { border-color: #999; }
.modal-viewer { width: 100%; aspect-ratio: 16/9; }
.modal-footer { padding: .55rem 1.4rem; border-top: 1px solid #e0e0dc; font-family: 'Space Mono', monospace; font-size: .56rem; color: #888; display: flex; gap: 1.5rem; }

.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
