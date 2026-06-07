import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const ROOM_RADIUS = 10
const ROOM_HEIGHT = 5.5

export function useGalleryScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.toneMapping = THREE.ReinhardToneMapping
  renderer.toneMappingExposure = 0.72

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xd4d0c8)

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.05, 80)
  camera.position.set(0, 1.65, 0)

  buildRoom(scene)

  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  })
  ro.observe(canvas.parentElement || canvas)

  function dispose() { ro.disconnect(); scene.environment?.dispose(); renderer.dispose() }
  return { renderer, scene, camera, dispose }
}

// Cable-hung SpotLights per painting
export function addTrackSpotLights(scene, wallPositions) {
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x282828, metalness: 0.85, roughness: 0.25 })
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.88, roughness: 0.12 })
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe8cc, emissive: 0xffe8cc, emissiveIntensity: 5.0
  })

  wallPositions.forEach(fp => {
    const angle = fp.angle
    const cx = Math.sin(angle) * 8.8
    const cz = Math.cos(angle) * 8.8
    const cableLen = 1.2
    const headY = ROOM_HEIGHT - cableLen

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, cableLen, 4), wireMat)
    cable.position.set(cx, ROOM_HEIGHT - cableLen / 2, cz)
    scene.add(cable)

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 10), headMat)
    head.position.set(cx, headY - 0.06, cz)
    scene.add(head)

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), bulbMat)
    bulb.position.set(cx, headY - 0.13, cz)
    scene.add(bulb)

    const spot = new THREE.SpotLight(0xffe8cc, 1.1, 9, 0.26, 0.35)
    spot.position.set(cx, headY - 0.1, cz)
    spot.target.position.set(fp.position.x, fp.position.y, fp.position.z)
    scene.add(spot)
    scene.add(spot.target)
  })
}

// Pendant lights over pedestal area
export function addPedestalPendants(scene) {
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x282828, metalness: 0.85, roughness: 0.25 })
  const headMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.88, roughness: 0.12 })
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e8, emissive: 0xfff5e8, emissiveIntensity: 6.0
  })
  const PEND_R     = 4.5
  const PEND_CNT   = 6
  const cableLen   = 2.0
  const BEAM_ANGLE = Math.PI / 10   // 18° cone half-angle

  // Canvas radial gradient → no hard edge, just warm luminance fading to nothing
  const sz = 128
  const poolCanvas = document.createElement('canvas')
  poolCanvas.width = poolCanvas.height = sz
  const pctx = poolCanvas.getContext('2d')
  const g = pctx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2)
  g.addColorStop(0.00, 'rgba(255,252,235,1.00)')
  g.addColorStop(0.28, 'rgba(255,249,225,0.72)')
  g.addColorStop(0.55, 'rgba(255,246,215,0.32)')
  g.addColorStop(0.80, 'rgba(255,242,205,0.09)')
  g.addColorStop(1.00, 'rgba(255,240,200,0.00)')
  pctx.fillStyle = g
  pctx.fillRect(0, 0, sz, sz)
  const poolTex = new THREE.CanvasTexture(poolCanvas)

  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: 0.20,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })

  // Very faint cone beam — suggests volume without looking like a solid shape
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfffbe8, transparent: true, opacity: 0.035,
    side: THREE.DoubleSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  for (let i = 0; i < PEND_CNT; i++) {
    const a = (i / PEND_CNT) * Math.PI * 2
    const px = Math.sin(a) * PEND_R
    const pz = Math.cos(a) * PEND_R
    const headY  = ROOM_HEIGHT - cableLen
    const lightY = headY - 0.08

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, cableLen, 4), wireMat)
    cable.position.set(px, ROOM_HEIGHT - cableLen / 2, pz)
    scene.add(cable)

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 10), headMat)
    head.position.set(px, headY - 0.06, pz)
    scene.add(head)

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), bulbMat)
    bulb.position.set(px, headY - 0.13, pz)
    scene.add(bulb)

    const beamH = lightY
    const beamR = beamH * Math.tan(BEAM_ANGLE)

    // Cone: apex at lamp, base at floor. DoubleSide+Additive — visible from inside looking up
    const beam = new THREE.Mesh(new THREE.ConeGeometry(beamR, beamH, 32, 1, true), beamMat)
    beam.position.set(px, lightY / 2, pz)
    scene.add(beam)

    // Gradient pool — radius slightly wider than beam for natural spill
    const pool = new THREE.Mesh(new THREE.CircleGeometry(beamR * 1.35, 36), poolMat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(px, 0.006, pz)
    scene.add(pool)

    // SpotLight — high penumbra for photographic soft edge, moderate intensity
    const spot = new THREE.SpotLight(0xfff8e8, 12, 0, Math.PI / 8, 0.70, 2)
    spot.position.set(px, lightY, pz)
    const spotTarget = new THREE.Object3D()
    spotTarget.position.set(px, 0, pz)
    scene.add(spotTarget)
    spot.target = spotTarget
    scene.add(spot)
  }
}

// ── Canvas-generated 清水模 (exposed concrete) textures ──────────────
function makeConcreteFloorTex() {
  const S = 512
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const ctx = cv.getContext('2d')

  ctx.fillStyle = '#9d9a95'
  ctx.fillRect(0, 0, S, S)

  // Fine aggregate speckle
  for (let i = 0; i < 22000; i++) {
    const x = Math.random() * S, y = Math.random() * S
    const v = 138 + Math.floor(Math.random() * 52 - 26)
    ctx.fillStyle = `rgba(${v},${v - 1},${v - 2},${0.10 + Math.random() * 0.25})`
    const r = 0.3 + Math.random() * 1.6
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill()
  }

  // Larger soft casting blotches
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * S, y = Math.random() * S
    const r = 30 + Math.random() * 80
    const delta = Math.random() > 0.5 ? -14 : 10
    const v = 157 + delta
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${v},${v - 1},${v - 3},0.20)`)
    g.addColorStop(1, `rgba(${v},${v - 1},${v - 3},0)`)
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  return cv
}

function makeConcreteWallTex() {
  const W = 512, H = 512
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')

  ctx.fillStyle = '#adaaa5'
  ctx.fillRect(0, 0, W, H)

  // Fine surface grain
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * W, y = Math.random() * H
    const v = 165 + Math.floor(Math.random() * 38 - 19)
    ctx.fillStyle = `rgba(${v},${v},${v - 2},${0.09 + Math.random() * 0.16})`
    ctx.fillRect(x, y, 0.7 + Math.random() * 1.3, 0.7 + Math.random() * 1.3)
  }

  // Horizontal pour joints — every ~0.6 m world-space
  // tile covers 2.75 m tall (5.5 m / repeat.y=2), 512px → 186 px/m → 112 px per 0.6 m
  for (let y = 112; y < H; y += 112) {
    const j = (Math.random() - 0.5) * 3
    ctx.strokeStyle = 'rgba(78,74,70,0.26)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y + j); ctx.lineTo(W, y + j); ctx.stroke()
    ctx.strokeStyle = 'rgba(225,222,218,0.10)'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y + j + 1); ctx.lineTo(W, y + j + 1); ctx.stroke()
  }

  // Tie-rod holes — 3 cm dia, every ~0.6 m vertical / ~1 m horizontal
  for (let hy = 55; hy < H; hy += 112) {
    for (let hx = 64; hx < W; hx += 128) {
      const jx = (Math.random() - 0.5) * 5, jy = (Math.random() - 0.5) * 3
      ctx.strokeStyle = 'rgba(68,65,62,0.40)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(hx + jx, hy + jy, 2.8, 0, 6.28); ctx.stroke()
      ctx.fillStyle = 'rgba(60,58,55,0.18)'
      ctx.beginPath(); ctx.arc(hx + jx, hy + jy + 0.8, 2.2, 0, 6.28); ctx.fill()
    }
  }

  return cv
}

function buildRoom(scene) {
  // ── 清水模 exposed-concrete walls ────────────────────────────────────
  const wallTex = new THREE.CanvasTexture(makeConcreteWallTex())
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(8, 2)   // 8 tiles round circumference, 2 tiles tall
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex, roughness: 0.55, metalness: 0.0, side: THREE.BackSide
  })
  const walls = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, ROOM_HEIGHT, 32, 1, true),
    wallMat
  )
  walls.position.y = ROOM_HEIGHT / 2
  scene.add(walls)

  // ── 清水模 concrete floor ─────────────────────────────────────────────
  const floorTex = new THREE.CanvasTexture(makeConcreteFloorTex())
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(5, 5)  // tiles every 2 m — aggregate grain reads at walking distance
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, roughness: 0.84, metalness: 0.0
  })
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 32), floorMat)
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // ── White ceiling ──────────────────────────────────────────────────
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xeae8e4, roughness: 0.80, metalness: 0.0
  })
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 32), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = ROOM_HEIGHT
  scene.add(ceil)

  // ── Skylight panel — large glowing disc ───────────────────────────
  const skylightMat = new THREE.MeshStandardMaterial({
    color: 0xc0dcf4, emissive: 0x80bce8, emissiveIntensity: 4.5, roughness: 0.9
  })
  const skylight = new THREE.Mesh(new THREE.CircleGeometry(4.8, 24), skylightMat)
  skylight.rotation.x = Math.PI / 2
  skylight.position.y = ROOM_HEIGHT - 0.008
  scene.add(skylight)

  // Fill from skylight — pedestal accent lights handle close-range illumination
  const skylightPL = new THREE.PointLight(0xd0e8ff, 0.9, ROOM_RADIUS * 2.8)
  skylightPL.position.set(0, ROOM_HEIGHT - 0.05, 0)
  scene.add(skylightPL)

  // ── Baseboard ─────────────────────────────────────────────────────
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x989490, roughness: 0.9, metalness: 0.0, side: THREE.BackSide
  })
  const baseboard = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS - 0.01, ROOM_RADIUS - 0.01, 0.10, 32, 1, true),
    baseMat
  )
  baseboard.position.y = 0.05
  scene.add(baseboard)

  // ── Horizontal accent bands ────────────────────────────────────────
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xb4b0ac, roughness: 0.92, metalness: 0.0, side: THREE.BackSide
  })
  const band1 = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS - 0.005, ROOM_RADIUS - 0.005, 0.03, 32, 1, true),
    bandMat
  )
  band1.position.y = 0.90
  scene.add(band1)

  const band2 = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS - 0.005, ROOM_RADIUS - 0.005, 0.03, 32, 1, true),
    bandMat
  )
  band2.position.y = ROOM_HEIGHT - 0.35
  scene.add(band2)

  // ── Ceiling reveal ─────────────────────────────────────────────────
  const revealMat = new THREE.MeshStandardMaterial({
    color: 0x848280, roughness: 1.0, metalness: 0.0, side: THREE.BackSide
  })
  const ceilReveal = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS - 0.005, ROOM_RADIUS - 0.005, 0.06, 32, 1, true),
    revealMat
  )
  ceilReveal.position.y = ROOM_HEIGHT - 0.03
  scene.add(ceilReveal)

  // Moderate ambient — pendant pools are 5× above this (natural ratio), room never goes pitch-black
  scene.add(new THREE.HemisphereLight(0xd0e8ff, 0xb8b0a0, 0.20))
  scene.add(new THREE.AmbientLight(0xfff8f4, 0.05))
}

// ── Iridescent caustic on floor + streaming light on walls ────────────
export function addCausticEffect(scene) {
  // Floor caustic
  const SZ = 64
  const causticCanvas = document.createElement('canvas')
  causticCanvas.width = causticCanvas.height = SZ
  const ctx = causticCanvas.getContext('2d')

  const causticTex = new THREE.CanvasTexture(causticCanvas)
  causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping
  causticTex.repeat.set(2.5, 2.5)

  const causticMesh = new THREE.Mesh(
    new THREE.CircleGeometry(ROOM_RADIUS - 0.3, 32),
    new THREE.MeshBasicMaterial({
      map: causticTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35,
    })
  )
  causticMesh.rotation.x = -Math.PI / 2
  causticMesh.position.y = 0.004
  scene.add(causticMesh)

  // Wall caustic — streaming light beams from skylight
  const WSZ = 64
  const wCanvas = document.createElement('canvas')
  wCanvas.width = wCanvas.height = WSZ
  const wCtx = wCanvas.getContext('2d')

  const wallTex = new THREE.CanvasTexture(wCanvas)
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping
  wallTex.repeat.set(4, 1)

  const wallCausticMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM_RADIUS - 0.12, ROOM_RADIUS - 0.12, ROOM_HEIGHT, 32, 1, true),
    new THREE.MeshBasicMaterial({
      map: wallTex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.28,
      side: THREE.BackSide,
    })
  )
  wallCausticMesh.position.y = ROOM_HEIGHT / 2
  scene.add(wallCausticMesh)

  // 3 prismatic PointLights orbiting near ceiling
  const PRISMA = [0x99ccff, 0xffbbdd, 0xaaffee]
  const prismaLights = PRISMA.map(c => {
    const pl = new THREE.PointLight(c, 1.0, 13)
    scene.add(pl)
    return pl
  })

  function drawFloorCaustic(time) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, SZ, SZ)
    ctx.globalCompositeOperation = 'lighter'
    const N = 6
    for (let i = 0; i < N; i++) {
      const fi = i / N
      const t1 = time * (0.00021 + fi * 0.00009) + fi * Math.PI * 2.618
      const t2 = time * (0.00016 - fi * 0.00006) + fi * 1.91
      const x = (0.5 + Math.sin(t1) * Math.cos(t2 * 0.74) * 0.42) * SZ
      const y = (0.5 + Math.cos(t1 * 0.88) * Math.sin(t2 * 0.82 + 1.4) * 0.42) * SZ
      const r = SZ * (0.065 + 0.03 * Math.sin(time * 0.0009 + fi * 5.5))
      const hue = ((fi * 300 + time * 0.02) % 360)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0,   `hsla(${hue}, 100%, 96%, 0.95)`)
      g.addColorStop(0.4, `hsla(${(hue + 50) % 360}, 85%, 72%, 0.32)`)
      g.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = g; ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
    causticTex.needsUpdate = true
  }

  function drawWallCaustic(time) {
    wCtx.fillStyle = '#000'
    wCtx.fillRect(0, 0, WSZ, WSZ)
    wCtx.globalCompositeOperation = 'lighter'

    // 3 vertical streaming light beams per tile, with prismatic edges
    for (let i = 0; i < 3; i++) {
      const fi = i / 3
      const bx = (fi + 0.17 + Math.sin(time * 0.000075 + fi * 2.3) * 0.09) * WSZ
      const bw = WSZ * (0.055 + 0.022 * Math.cos(time * 0.000110 + fi * 3.1))
      const bright = 0.26 + 0.50 * Math.abs(Math.sin(time * 0.000085 + fi * 1.5))

      // Core white/cool streak
      const g = wCtx.createLinearGradient(bx - bw * 2.2, 0, bx + bw * 2.2, 0)
      g.addColorStop(0,   'rgba(0,0,0,0)')
      g.addColorStop(0.3, `rgba(210,235,255,${bright * 0.44})`)
      g.addColorStop(0.5, `rgba(255,255,255,${bright})`)
      g.addColorStop(0.7, `rgba(255,240,220,${bright * 0.38})`)
      g.addColorStop(1,   'rgba(0,0,0,0)')
      wCtx.fillStyle = g
      wCtx.fillRect(bx - bw * 2.8, 0, bw * 5.6, WSZ)

      // Prismatic edge (rainbow fringe)
      const hue = (fi * 200 + time * 0.005) % 360
      const pg = wCtx.createLinearGradient(bx + bw * 0.5, 0, bx + bw * 1.7, 0)
      pg.addColorStop(0, `hsla(${hue}, 100%, 76%, ${bright * 0.50})`)
      pg.addColorStop(1, 'rgba(0,0,0,0)')
      wCtx.fillStyle = pg
      wCtx.fillRect(bx + bw * 0.3, 0, bw * 1.5, WSZ)
    }

    wCtx.globalCompositeOperation = 'source-over'
    wallTex.needsUpdate = true
  }

  return {
    update(time) {
      drawFloorCaustic(time)
      drawWallCaustic(time)
      prismaLights.forEach((pl, i) => {
        const a = time * 0.00018 + (i / 3) * Math.PI * 2
        const r = 2.0 + Math.sin(time * 0.00028 + i * 1.8) * 0.8
        pl.position.set(Math.sin(a) * r, ROOM_HEIGHT - 0.4, Math.cos(a) * r)
      })
    },
    dispose() {
      causticTex.dispose(); causticMesh.geometry.dispose(); causticMesh.material.dispose()
      wallTex.dispose(); wallCausticMesh.geometry.dispose(); wallCausticMesh.material.dispose()
    }
  }
}
