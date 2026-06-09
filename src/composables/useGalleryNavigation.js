import * as THREE from 'three'

const ACCEL      = 0.007
const DAMPING    = 0.86
const MAX_SPEED  = 0.09
const LOOK_SENS  = 0.003
const ROOM_LIMIT = 8.5
const PITCH_LIMIT = 1.2
const DEG2RAD    = Math.PI / 180

const FOCUS_ROT_SENS  = 0.005
const FOCUS_ZOOM_SPEED = 0.45
const FOCUS_ZOOM_MIN   = 0.8
const FOCUS_ZOOM_MAX   = 5.0
const ANIM_DURATION    = 0.65
const FREE_ZOOM_STEP   = 0.05

const PEDESTAL_HEIGHT  = 0.9
const MODEL_BASE_Y     = PEDESTAL_HEIGHT + 0.22
const FOCUS_SCALE      = 2.5

// Virtual joystick
const JOY_RADIUS  = 55   // pixels — max thumb displacement
const JOY_ACCEL   = 10   // multiplier over base ACCEL

function smoothstep(t) { return t * t * (3 - 2 * t) }
function lerp(a, b, t)  { return a + (b - a) * t }

const _up       = new THREE.Vector3(0, 1, 0)
const _wheelDir = new THREE.Vector3()

export function useGalleryNavigation(camera, canvas) {
  let yaw = 0
  let pitch = 0

  const keys = new Set()
  const velocity = new THREE.Vector3()

  let dragging = false, lastX = 0, lastY = 0
  let focusDragging = false, focusLastX = 0, focusLastY = 0

  // Camera-rotation touch (right side / general)
  let touchId = -1, touchX = 0, touchY = 0

  // Joystick touch (left half of screen, free mode)
  let joyId = -1, joyBaseX = 0, joyBaseY = 0, joyNx = 0, joyNz = 0

  // Gyroscope state
  let gyroEnabled = false
  let gyroBaseAlpha = null
  let gyroBaseBeta  = null
  let gyroBaseYaw   = 0
  let gyroBasePitch = 0
  let gyroRawYaw    = 0
  let gyroRawPitch  = 0

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
    pedModelPos: new THREE.Vector3(),
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

  // ── Mouse ──────────────────────────────────────────────────────────────────

  function onMouseDown(e) {
    if (e.button !== 0) return
    if (focusState.mode === 'focused') {
      focusDragging = true
      focusLastX = e.clientX; focusLastY = e.clientY
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
      focusLastX = e.clientX; focusLastY = e.clientY
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
      if (dist >= FOCUS_ZOOM_MIN && dist <= FOCUS_ZOOM_MAX) camera.position.copy(newPos)
      return
    }
    if (focusState.mode === 'free') {
      e.preventDefault()
      camera.getWorldDirection(_wheelDir)
      _wheelDir.y = 0; _wheelDir.normalize()
      velocity.addScaledVector(_wheelDir, (e.deltaY < 0 ? 1 : -1) * FREE_ZOOM_STEP)
    }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  function onKeyDown(e) {
    if (e.key === 'Escape') { exitFocus(); return }
    if (focusState.mode !== 'free') return
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault(); keys.add(e.key.toLowerCase())
    }
  }

  function onKeyUp(e) { keys.delete(e.key.toLowerCase()) }

  // ── Touch (multi-touch: joystick + camera) ─────────────────────────────────

  function onTouchStart(e) {
    for (const t of e.changedTouches) {
      // In focused mode, any finger = model-rotation touch
      if (focusState.mode === 'focused' || focusState.mode !== 'free') {
        if (touchId === -1) { touchId = t.identifier; touchX = t.clientX; touchY = t.clientY }
        continue
      }

      // Free mode: left 45% of screen = joystick, otherwise = camera look
      const isLeftZone = t.clientX < window.innerWidth * 0.45

      if (isLeftZone && joyId === -1) {
        joyId = t.identifier
        joyBaseX = t.clientX; joyBaseY = t.clientY
        joyNx = 0; joyNz = 0
      } else if (!isLeftZone && touchId === -1) {
        touchId = t.identifier; touchX = t.clientX; touchY = t.clientY
      }
    }
  }

  function onTouchMove(e) {
    for (const t of e.changedTouches) {
      // Joystick
      if (t.identifier === joyId) {
        const dx = t.clientX - joyBaseX
        const dy = t.clientY - joyBaseY
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const clamped = Math.min(len, JOY_RADIUS)
        joyNx = dx / len * clamped / JOY_RADIUS  // [-1, 1]
        joyNz = dy / len * clamped / JOY_RADIUS
        continue
      }

      if (t.identifier !== touchId) continue

      // Focused mode — rotate model
      if (focusState.mode === 'focused' && focusState.activeModelGroup) {
        const dx = t.clientX - touchX
        const dy = t.clientY - touchY
        focusState.activeModelGroup.rotation.y += dx * FOCUS_ROT_SENS
        focusState.activeModelGroup.rotation.x = THREE.MathUtils.clamp(
          focusState.activeModelGroup.rotation.x + dy * FOCUS_ROT_SENS,
          -Math.PI / 2, Math.PI / 2
        )
        touchX = t.clientX; touchY = t.clientY
        continue
      }

      // Free mode — camera look (only when gyro is off)
      if (focusState.mode === 'free' && !gyroEnabled) {
        yaw -= (t.clientX - touchX) * LOOK_SENS * 1.8
        pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch - (t.clientY - touchY) * LOOK_SENS * 1.8))
        touchX = t.clientX; touchY = t.clientY
      }
    }
  }

  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = -1; joyNx = 0; joyNz = 0 }
      if (t.identifier === touchId) { touchId = -1 }
    }
  }

  // ── Gyroscope ──────────────────────────────────────────────────────────────

  function onDeviceOrientation(e) {
    if (!gyroEnabled || focusState.mode !== 'free') return
    if (e.alpha === null || e.beta === null) return

    const alpha = e.alpha
    const beta  = e.beta

    if (gyroBaseAlpha === null) {
      gyroBaseAlpha = alpha; gyroBaseBeta  = beta
      gyroBaseYaw   = yaw;   gyroBasePitch = pitch
      gyroRawYaw    = yaw;   gyroRawPitch  = pitch
      return
    }

    // W3C: alpha increases CCW from above → turning left = alpha increases = yaw increases
    let deltaAlpha = alpha - gyroBaseAlpha
    if (deltaAlpha >  180) deltaAlpha -= 360
    if (deltaAlpha < -180) deltaAlpha += 360

    // beta: ~90° upright portrait; tilting top away (looking up) = beta increases
    const deltaBeta = beta - gyroBaseBeta

    gyroRawYaw   = gyroBaseYaw + deltaAlpha * DEG2RAD
    gyroRawPitch = THREE.MathUtils.clamp(
      gyroBasePitch + deltaBeta * DEG2RAD,
      -PITCH_LIMIT, PITCH_LIMIT
    )
  }

  function onScreenOrientationChange() {
    if (gyroEnabled) gyroBaseAlpha = null
  }

  async function enableGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result !== 'granted') return false
      } catch { return false }
    }
    gyroEnabled   = true
    gyroBaseAlpha = null
    gyroRawYaw    = yaw
    gyroRawPitch  = pitch
    window.addEventListener('deviceorientation', onDeviceOrientation)
    window.addEventListener('orientationchange', onScreenOrientationChange)
    return true
  }

  function disableGyro() {
    gyroEnabled = false
    gyroBaseAlpha = null
    window.removeEventListener('deviceorientation', onDeviceOrientation)
    window.removeEventListener('orientationchange', onScreenOrientationChange)
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  canvas.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup',   onMouseUp)
  window.addEventListener('keydown',   onKeyDown)
  window.addEventListener('keyup',     onKeyUp)
  canvas.addEventListener('wheel',     onWheel, { passive: false })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: true })
  canvas.addEventListener('touchend',   onTouchEnd)
  canvas.addEventListener('touchcancel', onTouchEnd)

  // ── Update loop ────────────────────────────────────────────────────────────

  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const dir   = new THREE.Vector3()
  const right = new THREE.Vector3()

  function update(delta = 0.016) {
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

    // Gyroscope — frame-rate-independent exponential smoothing
    if (gyroEnabled) {
      const k = 1 - Math.exp(-delta / 0.04)
      yaw   = lerp(yaw,   gyroRawYaw,   k)
      pitch = lerp(pitch, gyroRawPitch, k)
    }

    euler.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(euler)

    camera.getWorldDirection(dir); dir.y = 0; dir.normalize()
    right.crossVectors(dir, _up).normalize()

    // Keyboard
    if (keys.size > 0) {
      if (keys.has('w') || keys.has('arrowup'))    velocity.addScaledVector(dir,   ACCEL)
      if (keys.has('s') || keys.has('arrowdown'))  velocity.addScaledVector(dir,  -ACCEL)
      if (keys.has('d') || keys.has('arrowright')) velocity.addScaledVector(right,  ACCEL)
      if (keys.has('a') || keys.has('arrowleft'))  velocity.addScaledVector(right, -ACCEL)
    }

    // Virtual joystick
    if (joyId !== -1) {
      velocity.addScaledVector(dir,  -joyNz * ACCEL * JOY_ACCEL)  // up = forward
      velocity.addScaledVector(right, joyNx * ACCEL * JOY_ACCEL)
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
    window.removeEventListener('mouseup',   onMouseUp)
    window.removeEventListener('keydown',   onKeyDown)
    window.removeEventListener('keyup',     onKeyUp)
    canvas.removeEventListener('wheel',     onWheel)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove',  onTouchMove)
    canvas.removeEventListener('touchend',   onTouchEnd)
    canvas.removeEventListener('touchcancel', onTouchEnd)
    disableGyro()
  }

  function getPos()        { return camera.position }
  function getYaw()        { return yaw }
  function getFocusMode()  { return focusState.mode }
  function getFocusedIdx() { return focusState.focusedPedestalIdx }
  function getJoystickState() {
    return {
      active: joyId !== -1,
      baseX: joyBaseX,
      baseY: joyBaseY,
      nx: joyNx,  // [-1, 1]
      nz: joyNz,
    }
  }

  return {
    update, unbind,
    getPos, getYaw, getFocusMode, getFocusedIdx,
    enterFocus, exitFocus,
    enableGyro, disableGyro,
    getJoystickState,
  }
}
