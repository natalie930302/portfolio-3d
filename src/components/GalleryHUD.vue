<template>
  <!-- ── 準心 — 自由模式輔助對準（桌機滑鼠用，手機不顯示） ──────── -->
  <div v-if="focusMode === 'free' && !isMobile" class="crosshair" />

  <!-- ── 俯視小地圖 — 自由模式，右下角 ──────────────────────────── -->
  <div v-if="focusMode === 'free' && pedestalPositions?.length" class="minimap-wrap">
    <svg class="minimap-svg" viewBox="-11 -11 22 22" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="map-clip"><circle r="10.2" /></clipPath>
      </defs>
      <!-- Background disc -->
      <circle r="11" fill="rgba(6,4,2,0.78)" />
      <!-- Room boundary ring -->
      <circle r="10" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="0.22"/>
      <!-- Inner ring guide -->
      <circle r="3.2" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.15" stroke-dasharray="0.6 0.4"/>
      <circle r="5.8" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.15" stroke-dasharray="0.6 0.4"/>
      <g clip-path="url(#map-clip)">
        <!-- Pedestal dots -->
        <g
          v-for="(pos, i) in pedestalPositions"
          :key="i"
          style="cursor: pointer"
          @click="$emit('navigate', i)"
        >
          <!-- Large transparent hit target -->
          <circle :cx="pos.x" :cy="pos.z" r="1.8" fill="transparent" />
          <!-- Visual dot -->
          <circle
            :cx="pos.x" :cy="pos.z"
            :r="focusedWork?.index === i ? 1.15 : hoveredWork?.index === i ? 1.0 : 0.80"
            :fill="focusedWork?.index === i
              ? 'rgba(255,218,130,0.92)'
              : hoveredWork?.index === i
              ? 'rgba(255,255,255,0.88)'
              : 'rgba(255,255,255,0.30)'"
          />
          <!-- Work number -->
          <text
            :x="pos.x" :y="pos.z + 0.42"
            text-anchor="middle"
            font-size="1.05"
            font-family="monospace"
            :fill="focusedWork?.index === i
              ? 'rgba(20,14,8,0.95)'
              : 'rgba(255,255,255,0.0)'"
            style="pointer-events:none; font-weight:bold"
          >{{ i + 1 }}</text>
        </g>
        <!-- Player facing direction line -->
        <line
          :x1="playerState.x"
          :y1="playerState.z"
          :x2="playerState.x + (-Math.sin(playerState.yaw)) * 2.2"
          :y2="playerState.z + (-Math.cos(playerState.yaw)) * 2.2"
          stroke="rgba(255,255,255,0.70)"
          stroke-width="0.40"
          stroke-linecap="round"
        />
        <!-- Player dot -->
        <circle
          :cx="playerState.x" :cy="playerState.z"
          r="0.70"
          fill="rgba(255,255,255,0.95)"
        />
      </g>
    </svg>
    <div class="minimap-label">{{ total }} 件</div>
  </div>

  <!-- ── Hover 展品提示卡 — 頂部居中 ───────────────────────────── -->
  <Transition name="hover-pop">
    <div v-if="hoveredWork && focusMode === 'free'" class="hover-wrap">
      <div class="hover-card">
        <span class="hover-num">{{ String(hoveredWork.index + 1).padStart(2, '0') }}</span>
        <div class="hover-body">
          <span class="hover-name">{{ hoveredWork.name }}</span>
          <span class="hover-cta">點擊近看</span>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── 返回按鈕 — 左上，焦點模式 ──────────────────────────────── -->
  <Transition name="fade-left">
    <button v-if="focusMode === 'focused'" class="back-btn" @click="$emit('exitFocus')">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
           stroke="currentColor" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.5 2L4 6.5L8.5 11" />
      </svg>
      返回展廳
    </button>
  </Transition>

  <!-- ── 前 / 後展品導覽箭頭 — 焦點模式 ────────────────────────── -->
  <Transition name="fade">
    <div v-if="focusMode === 'focused'" class="nav-arrows">
      <button class="nav-arrow" aria-label="上一件展品" @click="$emit('prevWork')">‹</button>
      <button class="nav-arrow" aria-label="下一件展品" @click="$emit('nextWork')">›</button>
    </div>
  </Transition>

  <!-- ── 焦點資訊欄 — 底部，焦點模式 ───────────────────────────── -->
  <Transition name="bar-up">
    <div v-if="focusMode === 'focused'" class="focus-bar">
      <div class="focus-left">
        <span class="focus-idx">{{ String((focusedWork?.index ?? 0) + 1).padStart(2, '0') }}</span>
        <div class="focus-text">
          <div class="focus-name">{{ focusedWork?.name }}</div>
        </div>
      </div>
      <div class="focus-right">
        <button class="focus-esc" @click="$emit('exitFocus')">ESC</button>
      </div>
    </div>
  </Transition>

  <!-- ── 底部資訊列 — 自由 / 動畫過渡中 ──────────────────────────── -->
  <Transition name="fade">
    <div v-if="focusMode !== 'focused'" class="bottom-bar">
      <span class="attribution">111113213 &nbsp;·&nbsp; 數資四 &nbsp;·&nbsp; 許安婷</span>
<span class="work-count" style="opacity:0">·</span>
    </div>
  </Transition>

  <!-- ── 說明按鈕 ────────────────────────────────────────────────── -->
  <button class="help-btn" :aria-label="showHelp ? '關閉' : '操作指引'"
          @click="showHelp = !showHelp">
    {{ showHelp ? '×' : '?' }}
  </button>

  <!-- ── 說明面板 ────────────────────────────────────────────────── -->
  <Transition name="panel">
    <div v-if="showHelp" class="help-panel">
      <div class="help-header">操作指引</div>

      <!-- 手機版 -->
      <template v-if="isMobile">
        <div class="help-section">
          <div class="help-label">自由漫遊</div>
          <div class="help-row"><kbd>左側滑動</kbd><span>移動位置</span></div>
          <div class="help-row"><kbd>右側滑動</kbd><span>環顧展廳</span></div>
          <div class="help-row"><kbd>陀螺儀</kbd><span>傾斜手機轉頭</span></div>
          <div class="help-row"><kbd>點擊展品</kbd><span>近距離觀賞</span></div>
        </div>
        <div class="help-section">
          <div class="help-label">觀賞展品</div>
          <div class="help-row"><kbd>單指拖曳</kbd><span>360° 旋轉模型</span></div>
          <div class="help-row"><kbd>雙指捏合</kbd><span>縮放觀賞距離</span></div>
          <div class="help-row"><kbd>‹ ›</kbd><span>切換上下件展品</span></div>
          <div class="help-row"><kbd>返回展廳</kbd><span>離開觀賞模式</span></div>
        </div>
      </template>

      <!-- 桌機版 -->
      <template v-else>
        <div class="help-section">
          <div class="help-label">自由漫遊</div>
          <div class="help-row"><kbd>拖曳滑鼠</kbd><span>環顧展廳</span></div>
          <div class="help-row"><kbd>W A S D</kbd><span>前後左右移動</span></div>
          <div class="help-row"><kbd>滾輪</kbd><span>快速前進後退</span></div>
          <div class="help-row"><kbd>點擊展品</kbd><span>近距離觀賞</span></div>
        </div>
        <div class="help-section">
          <div class="help-label">觀賞展品</div>
          <div class="help-row"><kbd>拖曳</kbd><span>360° 旋轉模型</span></div>
          <div class="help-row"><kbd>滾輪</kbd><span>縮放觀賞距離</span></div>
          <div class="help-row"><kbd>‹ ›</kbd><span>切換上下件展品</span></div>
          <div class="help-row"><kbd>ESC / 右鍵</kbd><span>返回展廳</span></div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
defineProps({
  works:             Array,
  pedestalPositions: Array,
  playerState:       { type: Object, default: () => ({ x: 0, z: 0, yaw: 0 }) },
  hoveredWork:       Object,
  total:             Number,
  focusMode:         { type: String, default: 'free' },
  focusedWork:       Object,
})
defineEmits(['exitFocus', 'navigate', 'prevWork', 'nextWork'])
const showHint = ref(true)
const showHelp = ref(false)
const isMobile = navigator.maxTouchPoints > 0
onMounted(() => setTimeout(() => { showHint.value = false }, 5500))
</script>

<style scoped>
/* ── 準心 ────────────────────────────────────────────────────────── */
.crosshair {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 4px; height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 20;
}

/* ── 俯視小地圖 ─────────────────────────────────────────────────── */
.minimap-wrap {
  position: fixed;
  bottom: 1.4rem;
  right: 1.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.40rem;
  z-index: 22;
  pointer-events: none;
}
.minimap-svg {
  width: 90px;
  height: 90px;
  pointer-events: all;
  filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.50));
  border-radius: 50%;
}
.minimap-label {
  font-family: 'Space Mono', monospace;
  font-size: 0.52rem;
  color: rgba(255, 255, 255, 0.48);
  letter-spacing: 0.14em;
  pointer-events: none;
}

/* ── Hover 展品提示卡 ─────────────────────────────────────────────── */
.hover-wrap {
  position: fixed;
  top: 1.4rem;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}
.hover-card {
  display: flex;
  align-items: center;
  gap: 0.95rem;
  background: rgba(8, 6, 4, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.09);
  padding: 0.50rem 1.15rem 0.50rem 0.80rem;
  border-radius: 2px;
  white-space: nowrap;
}
.hover-num {
  font-family: 'Space Mono', monospace;
  font-size: 1.0rem;
  color: rgba(255, 218, 130, 0.62);
  letter-spacing: 0.06em;
  line-height: 1;
}
.hover-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.hover-name {
  font-family: 'Noto Serif TC', serif;
  font-size: 0.88rem;
  font-weight: 300;
  color: rgba(255, 252, 248, 0.94);
  letter-spacing: 0.05em;
}
.hover-cta {
  font-family: 'Space Mono', monospace;
  font-size: 0.60rem;
  color: rgba(255, 218, 130, 0.48);
  letter-spacing: 0.14em;
}

/* ── 返回按鈕 ────────────────────────────────────────────────────── */
.back-btn {
  position: fixed;
  top: 1.4rem; left: 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.42rem;
  background: rgba(8, 6, 4, 0.80);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 252, 248, 0.76);
  font-family: 'Space Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.10em;
  padding: 0.50rem 0.95rem 0.50rem 0.68rem;
  border-radius: 2px;
  cursor: pointer;
  z-index: 30;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}
.back-btn:hover {
  background: rgba(18, 14, 10, 0.92);
  border-color: rgba(255, 218, 130, 0.30);
  color: rgba(255, 218, 130, 0.90);
}
.back-btn svg { flex-shrink: 0; opacity: 0.68; }

/* ── 前後導覽箭頭 ────────────────────────────────────────────────── */
.nav-arrows {
  position: fixed;
  top: 50%; left: 0; right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-between;
  padding: 0 1rem;
  pointer-events: none;
  z-index: 24;
}
.nav-arrow {
  pointer-events: all;
  background: rgba(8, 6, 4, 0.52);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.11);
  color: rgba(255, 252, 248, 0.65);
  font-size: 1.35rem;
  width: 2.2rem;
  height: 3.8rem;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  user-select: none;
}
.nav-arrow:hover {
  background: rgba(18, 14, 10, 0.82);
  border-color: rgba(255, 218, 130, 0.32);
  color: rgba(255, 218, 130, 0.90);
}

/* ── 焦點資訊欄 ──────────────────────────────────────────────────── */
.focus-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  background: rgba(8, 6, 4, 0.90);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding: 0.88rem 1.6rem;
  z-index: 25;
}
.focus-left {
  display: flex;
  align-items: flex-start;
  gap: 1.05rem;
  min-width: 0;
}
.focus-idx {
  font-family: 'Space Mono', monospace;
  font-size: 1.5rem;
  color: rgba(255, 218, 130, 0.45);
  letter-spacing: 0.05em;
  line-height: 1;
  flex-shrink: 0;
  padding-top: 0.08rem;
}
.focus-text {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  min-width: 0;
}
.focus-name {
  font-family: 'Noto Serif TC', serif;
  font-size: 0.94rem;
  font-weight: 300;
  color: rgba(255, 252, 248, 0.94);
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.focus-desc {
  font-family: 'Noto Serif TC', serif;
  font-size: 0.68rem;
  font-weight: 300;
  color: rgba(255, 252, 248, 0.44);
  letter-spacing: 0.04em;
  line-height: 1.65;
}
.focus-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}
.focus-controls {
  font-family: 'Space Mono', monospace;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.50);
  letter-spacing: 0.10em;
  white-space: nowrap;
}
.focus-esc {
  font-family: 'Space Mono', monospace;
  font-size: 0.68rem;
  color: rgba(255, 218, 130, 0.68);
  letter-spacing: 0.12em;
  background: rgba(255, 218, 130, 0.08);
  border: 1px solid rgba(255, 218, 130, 0.20);
  padding: 0.32rem 0.80rem;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.focus-esc:hover {
  background: rgba(255, 218, 130, 0.16);
  border-color: rgba(255, 218, 130, 0.40);
  color: rgba(255, 218, 130, 0.95);
}

/* ── 底部資訊列 ──────────────────────────────────────────────────── */
.bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.80rem 1.4rem;
  z-index: 20;
  pointer-events: none;
}
.attribution {
  font-family: 'Noto Serif TC', serif;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.60);
  letter-spacing: 0.08em;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
}
.nav-hint {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Space Mono', monospace;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.58);
  letter-spacing: 0.10em;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
}
.work-count {
  font-family: 'Space Mono', monospace;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.40);
  letter-spacing: 0.10em;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
}
.count-unit { color: rgba(255, 255, 255, 0.24); }

/* ── 說明按鈕 ────────────────────────────────────────────────────── */
.help-btn {
  position: fixed;
  top: 1.4rem; right: 1.4rem;
  width: 2.05rem; height: 2.05rem;
  background: rgba(8, 6, 4, 0.78);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 50%;
  cursor: pointer;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.70);
  user-select: none;
  transition: background 0.18s ease, border-color 0.18s ease;
}
.help-btn:hover {
  background: rgba(18, 14, 10, 0.92);
  border-color: rgba(255, 255, 255, 0.24);
}

/* ── 說明面板 ────────────────────────────────────────────────────── */
.help-panel {
  position: fixed;
  top: 4.2rem; right: 1.4rem;
  width: 235px;
  background: rgba(8, 6, 4, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  padding: 1.1rem 1.35rem 1.3rem;
  z-index: 29;
  display: flex;
  flex-direction: column;
  gap: 0.90rem;
}
.help-header {
  font-family: 'Space Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.42);
  text-transform: uppercase;
  padding-bottom: 0.50rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.help-section {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}
.help-label {
  font-family: 'Space Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.14em;
  color: rgba(255, 218, 130, 0.50);
  text-transform: uppercase;
  margin-bottom: 0.08rem;
}
.help-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  align-items: baseline;
  gap: 0.60rem;
}
.help-row kbd {
  font-family: 'Space Mono', monospace;
  font-size: 0.62rem;
  color: rgba(255, 218, 130, 0.82);
  letter-spacing: 0.03em;
  background: none; border: none; padding: 0;
  text-align: right;
  white-space: nowrap;
}
.help-row span {
  font-family: 'Noto Serif TC', serif;
  font-size: 0.80rem;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.62);
  letter-spacing: 0.04em;
}

/* ── 過渡動畫 ────────────────────────────────────────────────────── */
.hover-pop-enter-active { transition: opacity 0.20s ease, transform 0.20s ease; }
.hover-pop-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.hover-pop-enter-from   { opacity: 0; transform: translateY(-7px); }
.hover-pop-leave-to     { opacity: 0; transform: translateY(-4px); }

.fade-left-enter-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.fade-left-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.fade-left-enter-from, .fade-left-leave-to { opacity: 0; transform: translateX(-10px); }

.bar-up-enter-active { transition: opacity 0.28s ease, transform 0.28s ease; }
.bar-up-leave-active { transition: opacity 0.20s ease, transform 0.20s ease; }
.bar-up-enter-from, .bar-up-leave-to { opacity: 0; transform: translateY(18px); }

.panel-enter-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.panel-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateX(8px); }

.fade-enter-active { transition: opacity 0.32s ease; }
.fade-leave-active { transition: opacity 0.20s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
