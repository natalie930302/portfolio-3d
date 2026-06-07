import * as THREE from 'three'

const ACCEL      = 0.007
const DAMPING    = 0.86
const MAX_SPEED  = 0.09
const LOOK_SENS  = 0.003
const ROOM_LIMIT = 8.5
const PITCH_LIMIT = 1.2   // ~69° — enough to look at ceiling pendants and floor

const FOCUS_ROT_SENS  = 0.005
const FOCUS_ZOOM_SPEED = 0.45
const FOCUS_ZOOM_MIN   = 0.8
const FOCUS_ZOOM_MAX   = 5.0
const ANIM_DURATION    = 0.65
const FREE_ZOOM_STEP   = 0.05

const PEDESTAL_HEIGHT  = 0.9
const MODEL_BASE_Y     = PEDESTAL_HEIGHT + 0.22  // modelGroup world Y (matches useGalleryPedestals)
const FOCUS_SCALE      = 2.5                     // must match GalleryScene.vue

function smoothstep(t) { return t * t * (3 - 2 * t) }
function lerp(a, b, t)  { return a + (b - a) * t }

// Pre-allocated vectors — never `new` inside hot paths
const _up       = new THREE.Vector3(0, 1, 0)
const _wheelDir = new THREE.Vector3()

export function useGalleryNavigation(camera, canvas) {
  let yaw = 0
  let pitch = 0

  const keys = new Set()
  const velocity = new THREE.Vector3()

  let dragging = false, lastX = 0, lastY = 0
  let focusDragging = false, focusLastX = 0, focusLastY = 0

  let touchId = -1, touchX = 0, touchY = 0

  const focusState = {
    mode: 'free',
    savedPos: new THREE.Vector3(),
    savedYaw: 0,
    savedPitch: 0,
    startPos: new THREE.Vector3(),
    startYaw: 0,
    startPitch: 0,
    targetPos: new THREE.Vector3(),
    targetYaw: 0,
    targetPitch: 0,
    animT: 0,
    activeModelGroup: null,
    focusedPedestalIdx: -1,
    pedModelPos: new THREE.Vector3(),  // actual model position — used for zoom distance clamping
  }

  function enterFocus(pedestalIdx, pedestalPos, modelGroup) {
    if (focusState.mode !== 'free') return

    focusState.savedPos.copy(camera.position)
    focusState.savedYaw   = yaw
    focusState.savedPitch = pitch

    const dir = new THREE.Vector3(pedestalPos.x, 0, pedestalPos.z).normalize()
    focusState.targetPos.set(
      pedestalPos.x - dir.x * 1.5,
      1.65,
      pedestalPos.z - dir.z * 1.5
    )

    // Model center cached in userData during load — no Box3 recomputation at click time
    const localCenterY = modelGroup.userData?.focusCenterLocalY ?? 0.35
    const MODEL_Y = MODEL_BASE_Y + localCenterY * FOCUS_SCALE

    const toModel = new THREE.Vector3(
      pedestalPos.x - focusState.targetPos.x,
      MODEL_Y - 1.65,
      pedestalPos.z - focusState.targetPos.z
    )
    focusState.targetYaw   = Math.atan2(-toModel.x, -toModel.z)
    focusState.targetPitch = Math.asin(THREE.MathUtils.clamp(toModel.y / toModel.length(), -1, 1))

    focusState.pedModelPos.set(pedestalPos.x, MODEL_Y, pedestalPos.z)
    focusState.startPos.copy(camera.position)
    focusState.startYaw   = yaw
    focusState.startPitch = pitch
    focusState.animT = 0
    focusState.mode = 'animIn'
    focusState.activeModelGroup = modelGroup
    focusState.focusedPedestalIdx = pedestalIdx

    velocity.set(0, 0, 0)
  }

  function exitFocus() {
    if (focusState.mode !== 'focused') return
    focusState.startPos.copy(camera.position)
    focusState.startYaw   = yaw
    focusState.startPitch = pitch
    focusState.animT = 0
    focusState.mode = 'animOut'
    focusDragging = false
  }

  function onMouseDown(e) {
    if (e.button !== 0) return
    if (focusState.mode === 'focused') {
      focusDragging = true
      focusLastX = e.clientX
      focusLastY = e.clientY
      canvas.style.cursor = 'grabbing'
      return
    }
    if (focusState.mode !== 'free') return
    dragging = true; lastX = e.clientX; lastY = e.clientY
    canvas.style.cursor = 'grabbing'
  }

  function onMouseMove(e) {
    if (focusDragging && focusState.mode === 'focused' && focusState.activeModelGroup) {
      const dx = e.clientX - focusLastX
      const dy = e.clientY - focusLastY
      focusLastX = e.clientX
      focusLastY = e.clientY
      focusState.activeModelGroup.rotation.y += dx * FOCUS_ROT_SENS
      focusState.activeModelGroup.rotation.x = THREE.MathUtils.clamp(
        focusState.activeModelGroup.rotation.x + dy * FOCUS_ROT_SENS,
        -Math.PI / 2, Math.PI / 2
      )
      return
    }
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    yaw -= dx * LOOK_SENS
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - dy * LOOK_SENS))
    lastX = e.clientX; lastY = e.clientY
  }

  function onMouseUp() {
    focusDragging = false
    dragging = false
    if (focusState.mode === 'focused') { canvas.style.cursor = 'grab'; return }
    canvas.style.cursor = ''
  }

  function onWheel(e) {
    if (focusState.mode === 'focused') {
      e.preventDefault()
      camera.getWorldDirection(_wheelDir)
      const step = (e.deltaY > 0 ? 1 : -1) * FOCUS_ZOOM_SPEED
      const newPos = camera.position.clone().addScaledVector(_wheelDir, -step)
      const dist = newPos.distanceTo(focusState.pedModelPos)
      if (dist >= FOCUS_ZOOM_MIN && dist <= FOCUS_ZOOM_MAX) {
        camera.position.copy(newPos)
      }
      return
    }
    if (focusState.mode === 'free') {
      e.preventDefault()
      camera.getWorldDirection(_wheelDir)
      _wheelDir.y = 0; _wheelDir.normalize()
      velocity.addScaledVector(_wheelDir, (e.deltaY < 0 ? 1 : -1) * FREE_ZOOM_STEP)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { exitFocus(); return }
    if (focusState.mode !== 'free') return
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault(); keys.add(e.key.toLowerCase())
    }
  }

  function onKeyUp(e) { keys.delete(e.key.toLowerCase()) }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touchId = e.touches[0].identifier; touchX = e.touches[0].clientX; touchY = e.touches[0].clientY
    }
  }
  function onTouchMove(e) {
    if (focusState.mode !== 'free') return
    for (const t of e.touches) {
      if (t.identifier !== touchId) continue
      yaw -= (t.clientX - touchX) * LOOK_SENS * 1.8
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - (t.clientY - touchY) * LOOK_SENS * 1.8))
      touchX = t.clientX; touchY = t.clientY
    }
  }
  function onTouchEnd() { touchId = -1 }

  canvas.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove', onTouchMove, { passive: true })
  canvas.addEventListener('touchend', onTouchEnd)

  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const dir   = new THREE.Vector3()
  const right = new THREE.Vector3()

  function update(delta = 0.016) {
    // Handle focus animation states
    if (focusState.mode === 'animIn' || focusState.mode === 'animOut') {
      focusState.animT = Math.min(1, focusState.animT + delta / ANIM_DURATION)
      const t = smoothstep(focusState.animT)

      if (focusState.mode === 'animIn') {
        camera.position.lerpVectors(focusState.startPos, focusState.targetPos, t)
        yaw   = lerp(focusState.startYaw,   focusState.targetYaw,   t)
        pitch = lerp(focusState.startPitch, focusState.targetPitch, t)
      } else {
        camera.position.lerpVectors(focusState.startPos, focusState.savedPos, t)
        yaw   = lerp(focusState.startYaw,   focusState.savedYaw,   t)
        pitch = lerp(focusState.startPitch, focusState.savedPitch, t)
      }

      camera.position.y = 1.65
      euler.set(pitch, yaw, 0)
      camera.quaternion.setFromEuler(euler)

      if (focusState.animT >= 1) {
        focusState.mode = (focusState.mode === 'animIn') ? 'focused' : 'free'
        if (focusState.mode === 'free') focusState.activeModelGroup = null
        if (focusState.mode === 'focused') canvas.style.cursor = 'grab'
      }
      return
    }

    if (focusState.mode === 'focused') {
      euler.set(pitch, yaw, 0)
      camera.quaternion.setFromEuler(euler)
      return
    }

    // Free navigation
    euler.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(euler)

    if (keys.size > 0) {
      camera.getWorldDirection(dir); dir.y = 0; dir.normalize()
      right.crossVectors(dir, _up).normalize()

      if (keys.has('w') || keys.has('arrowup'))    velocity.addScaledVector(dir, ACCEL)
      if (keys.has('s') || keys.has('arrowdown'))  velocity.addScaledVector(dir, -ACCEL)
      if (keys.has('d') || keys.has('arrowright')) velocity.addScaledVector(right, ACCEL)
      if (keys.has('a') || keys.has('arrowleft'))  velocity.addScaledVector(right, -ACCEL)
    }

    velocity.multiplyScalar(DAMPING)
    if (velocity.length() > MAX_SPEED) velocity.setLength(MAX_SPEED)
    if (velocity.length() < 0.0001) velocity.set(0, 0, 0)

    camera.position.add(velocity)

    const xz2 = camera.position.x ** 2 + camera.position.z ** 2
    if (xz2 > ROOM_LIMIT ** 2) {
      const scale = ROOM_LIMIT / Math.sqrt(xz2)
      camera.position.x *= scale
      camera.position.z *= scale
      velocity.x *= 0.1
      velocity.z *= 0.1
    }

    camera.position.y = 1.65
  }

  function unbind() {
    canvas.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
  }

  function getPos()       { return camera.position }
  function getYaw()       { return yaw }
  function getFocusMode() { return focusState.mode }
  function getFocusedIdx() { return focusState.focusedPedestalIdx }

  return { update, unbind, getPos, getYaw, enterFocus, exitFocus, getFocusMode, getFocusedIdx }
}
