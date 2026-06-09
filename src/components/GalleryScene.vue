<template>
  <div class="gallery-wrap">
    <canvas ref="canvasEl" class="gallery-canvas" />

    <!-- Gyroscope toggle — only shown on touch devices with DeviceOrientationEvent -->
    <button
      v-if="showGyroBtn && focusMode === 'free'"
      class="gyro-btn"
      :class="{ active: gyroActive, pending: gyroPending }"
      :title="gyroActive ? '重新校準 / 關閉陀螺儀' : '啟用陀螺儀鏡頭'"
      @click="toggleGyro"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(30 12 12)" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    </button>

    <!-- Virtual joystick (mobile, free mode only) -->
    <template v-if="showGyroBtn && focusMode === 'free'">
      <!-- Active joystick -->
      <div
        v-if="joystickState.active"
        class="joy-base"
        :style="{ left: joystickState.baseX + 'px', top: joystickState.baseY + 'px' }"
      >
        <div
          class="joy-thumb"
          :style="{
            transform: `translate(${joystickState.nx * 55}px, ${joystickState.nz * 55}px)`
          }"
        />
      </div>
    </template>

    <GalleryHUD
      :works="works"
      :pedestal-positions="positions"
      :player-state="playerState"
      :hovered-work="hoveredWork"
      :total="works.length"
      :focus-mode="focusMode"
      :focused-work="focusedWork"
      @exit-focus="navigation?.exitFocus()"
      @navigate="navigateToWork"
      @prev-work="handlePrevWork"
      @next-work="handleNextWork" />
  </div>
  <ModelModal :work="openWork" @close="openWork = null" />

  <Transition name="loader-fade">
    <div v-if="isLoading" class="loading-screen">
      <div class="loading-content">
        <div class="loading-id">111113213</div>
        <div class="loading-sub">數資四許安婷的課堂作品集</div>
        <div class="loading-bar"><div class="loading-bar-fill" /></div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import {
  useGalleryScene,
  addTrackSpotLights,
  addPedestalPendants,
  addCausticEffect,
} from "../composables/useGalleryScene.js";
import { useGalleryNavigation } from "../composables/useGalleryNavigation.js";
import { useGalleryPedestals } from "../composables/useGalleryPedestals.js";
import { useGalleryWallPaintings } from "../composables/useGalleryWallPaintings.js";
import { FAMOUS_PAINTINGS } from "../data/paintings.js";
import GalleryHUD from "./GalleryHUD.vue";
import ModelModal from "./ModelModal.vue";

const props = defineProps({ works: Array });

const canvasEl = ref(null);
const openWork = ref(null);
const hoveredWork = ref(null);
const focusMode = ref("free");
const focusedWork = ref(null);
const isLoading = ref(true);
const playerState = ref({ x: 0, z: 0, yaw: 0 });

// Gyroscope UI state
const gyroActive  = ref(false);
const gyroPending = ref(false);
const showGyroBtn = ref(
  typeof DeviceOrientationEvent !== 'undefined' && navigator.maxTouchPoints > 0
);

// Virtual joystick state (polled each frame)
const joystickState = ref({ active: false, baseX: 0, baseY: 0, nx: 0, nz: 0 });

async function toggleGyro() {
  if (!navigation) return;
  if (gyroPending.value) return;
  if (gyroActive.value) {
    navigation.disableGyro();
    gyroActive.value = false;
  } else {
    gyroPending.value = true;
    const ok = await navigation.enableGyro();
    gyroPending.value = false;
    gyroActive.value = ok;
  }
}

// Reused vectors to avoid per-frame allocation
const _sv = new THREE.Vector3();

let _cleanup = null;
let navigation = null;
let pendingNavIdx = -1;
let positions = [];
let modelGroups = [];

function navigateToWork(idx) {
  if (!navigation || idx < 0 || idx >= props.works.length) return;
  const mode = navigation.getFocusMode();
  if (mode === "focused") {
    pendingNavIdx = idx;
    navigation.exitFocus();
  } else if (mode === "free") {
    navigation.enterFocus(idx, positions[idx], modelGroups[idx]);
  }
}
function handlePrevWork() {
  if (!navigation) return;
  const idx = navigation.getFocusedIdx();
  navigateToWork(idx <= 0 ? props.works.length - 1 : idx - 1);
}
function handleNextWork() {
  if (!navigation) return;
  const idx = navigation.getFocusedIdx();
  navigateToWork(idx >= props.works.length - 1 ? 0 : idx + 1);
}

onMounted(() => {
  setTimeout(() => {
    isLoading.value = false;
  }, 3000);

  const canvas = canvasEl.value;

  let _downX = 0,
    _downY = 0,
    _wasDrag = false;
  const onDragTrack = (e) => {
    if (e.buttons & 1) {
      const dx = e.clientX - _downX,
        dy = e.clientY - _downY;
      if (dx * dx + dy * dy > 25) _wasDrag = true;
    }
  };
  canvas.addEventListener("mousedown", (e) => {
    _downX = e.clientX;
    _downY = e.clientY;
    _wasDrag = false;
  });
  window.addEventListener("mousemove", onDragTrack);

  const { renderer, scene, camera, dispose: disposeScene } = useGalleryScene(canvas);
  navigation = useGalleryNavigation(camera, canvas);

  const pedestals = useGalleryPedestals(scene, props.works);
  const wallPaintings = useGalleryWallPaintings(scene);

  // Compute wall painting positions for track lights
  const FRAME_RADIUS = 9.6;
  const FRAME_Y = 2.2;
  const wallPositions = FAMOUS_PAINTINGS.map((_, i) => {
    const count = FAMOUS_PAINTINGS.length;
    const angle = (i / count) * Math.PI * 2 + Math.PI;
    return {
      position: {
        x: Math.sin(angle) * FRAME_RADIUS,
        y: FRAME_Y,
        z: Math.cos(angle) * FRAME_RADIUS,
      },
      angle,
    };
  });

  addTrackSpotLights(scene, wallPositions);
  addPedestalPendants(scene);
  const caustic = addCausticEffect(scene);

  pedestals.loadAll();

  // Pre-computed — hoisted to module scope so navigateToWork can access them
  const pedestalGroups = pedestals.getPedestalGroups();
  positions = pedestals.getPedestalPositions();

  // Raycaster
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Pointer state — updated in onMove, consumed in render loop
  let _ptrX = 0,
    _ptrY = 0,
    _hoverIdx = -1;

  function findPedestalIdx(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData?.pedestalIdx !== undefined) return cur.userData.pedestalIdx;
      cur = cur.parent;
    }
    return -1;
  }

  function onMove(e) {
    _ptrX = e.clientX;
    _ptrY = e.clientY;
    const mode = navigation.getFocusMode();
    if (mode === "focused") {
      canvas.style.cursor = "grab";
      return;
    }
    if (mode !== "free") {
      canvas.style.cursor = "";
      return;
    }
    canvas.style.cursor = _hoverIdx >= 0 ? "pointer" : "";
  }

  function onClick(e) {
    if (_wasDrag) return;
    const mode = navigation.getFocusMode();
    if (mode === "focused" || mode !== "free") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pedestalGroups, true);
    const idx = hits.length ? findPedestalIdx(hits[0].object) : -1;
    if (idx >= 0) {
      navigation.enterFocus(idx, positions[idx], modelGroups[idx]);
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (navigation.getFocusMode() === "focused") navigation.exitFocus();
  }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("contextmenu", onContextMenu);

  const FOCUS_SCALE = 2.5; // scale target while focused
  modelGroups = pedestals.getModelGroups();

  let _lastFMode = "",
    _lastFocusTarget = -2;
  let _causticTick = 0;
  let rafId,
    lastTime = 0;

  function loop(t) {
    rafId = requestAnimationFrame(loop);
    const delta = Math.min((t - lastTime) / 1000, 0.1);
    lastTime = t;

    navigation.update(delta);
    const fMode = navigation.getFocusMode();
    const fIdx = navigation.getFocusedIdx();

    // Pending navigation — triggered by HUD prev/next or work strip click
    if (pendingNavIdx >= 0 && fMode === "free") {
      const ni = pendingNavIdx; pendingNavIdx = -1;
      navigation.enterFocus(ni, positions[ni], modelGroups[ni]);
    }

    // Only trigger Vue reactivity when value actually changes
    if (fMode !== _lastFMode) {
      focusMode.value = fMode;
      focusedWork.value = fMode !== "free" && fIdx >= 0
        ? { ...props.works[fIdx], index: fIdx }
        : null;
      _lastFMode = fMode;
    }

    const focusTarget = fMode !== "free" ? fIdx : -1;
    if (focusTarget !== _lastFocusTarget) {
      pedestals.setFocused(focusTarget);
      _lastFocusTarget = focusTarget;
    }
    pedestals.update(delta, t);
    if (_causticTick++ % 3 === 0) caustic.update(t);
    // Update minimap player state at ~10 fps (no need for full 60fps reactivity)
    if (_causticTick % 6 === 0) {
      playerState.value = { x: camera.position.x, z: camera.position.z, yaw: navigation.getYaw() }
    }

    // Joystick visual — update every frame when mobile
    if (showGyroBtn.value) {
      const js = navigation.getJoystickState()
      if (js.active || joystickState.value.active) joystickState.value = js
    }

    // Throttled raycasting — once per frame, only in free mode
    if (fMode === "free") {
      pointer.x = (_ptrX / window.innerWidth) * 2 - 1;
      pointer.y = -(_ptrY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pedestalGroups, true);
      const idx = hits.length ? findPedestalIdx(hits[0].object) : -1;
      if (idx !== _hoverIdx) {
        _hoverIdx = idx;
        hoveredWork.value = idx >= 0 ? { index: idx, name: props.works[idx]?.name } : null;
        pedestals.setHovered(idx);
        canvas.style.cursor = idx >= 0 ? "pointer" : "";
      }
    } else if (_hoverIdx !== -1) {
      _hoverIdx = -1;
      hoveredWork.value = null;
      pedestals.setHovered(-1);
    }

    // Scale-up animation: focused model grows, others stay at 1
    modelGroups.forEach((mg, i) => {
      const isFocused = i === fIdx && fMode !== "free";
      _sv.setScalar(isFocused ? FOCUS_SCALE : 1.0);
      mg.scale.lerp(_sv, isFocused ? 0.06 : 0.12);
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  _cleanup = () => {
    cancelAnimationFrame(rafId);
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("mousemove", onDragTrack);
    navigation.unbind();
    caustic.dispose();
    pedestals.disposeAll();
    wallPaintings.disposeAll();
    disposeScene();
  };
});

onUnmounted(() => _cleanup?.());
</script>

<style scoped>
.gallery-wrap {
  position: fixed;
  inset: 0;
  background: #d4d0c8;
  overscroll-behavior: none;
}
.gallery-canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #0e0c0a;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
}
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.loading-id {
  font-family: "Space Mono", monospace;
  font-size: 1.1rem;
  letter-spacing: 0.4em;
  color: rgba(255, 255, 255, 0.18);
  margin-bottom: 0.6rem;
}
.loading-sub {
  font-family: "Noto Serif TC", serif;
  font-size: 1.15rem;
  font-weight: 300;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.82);
  margin-bottom: 1.8rem;
}
.loading-bar {
  width: 100px;
  height: 1px;
  background: rgba(255, 255, 255, 0.10);
  border-radius: 1px;
  overflow: hidden;
}
.loading-bar-fill {
  height: 100%;
  background: rgba(255, 218, 130, 0.55);
  animation: bar-fill 2.6s ease-in-out forwards;
}
@keyframes bar-fill {
  from { width: 0; }
  to   { width: 100%; }
}

.loader-fade-leave-active {
  transition: opacity 0.7s ease;
}
.loader-fade-leave-to {
  opacity: 0;
}

/* ── Virtual joystick ─────────────────────────────────── */
.joy-base {
  position: fixed;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  background: rgba(14, 12, 10, 0.45);
  backdrop-filter: blur(4px);
  pointer-events: none;
  z-index: 41;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.joy-thumb {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 218, 130, 0.55);
  box-shadow: 0 0 14px rgba(255, 218, 130, 0.3);
  pointer-events: none;
  transition: background 0.1s;
}

/* ── Gyroscope button ──────────────────────────────────── */
.gyro-btn {
  position: fixed;
  bottom: 148px;
  right: 14px;
  z-index: 50;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  background: rgba(14, 12, 10, 0.72);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s, background 0.25s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.gyro-btn svg {
  width: 22px;
  height: 22px;
  transition: transform 0.6s ease;
}
.gyro-btn:active {
  transform: scale(0.94);
}
.gyro-btn.active {
  color: rgba(255, 218, 130, 0.9);
  border-color: rgba(255, 218, 130, 0.4);
  background: rgba(14, 12, 10, 0.85);
}
.gyro-btn.active svg {
  animation: gyro-spin 3s linear infinite;
}
.gyro-btn.pending {
  opacity: 0.5;
  pointer-events: none;
}
@keyframes gyro-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
