import * as THREE from 'three'
import { FAMOUS_PAINTINGS } from '../data/paintings.js'

const PAINTING_W = 2.4
const PAINTING_H = 1.8
const FRAME_RADIUS = 9.6
const FRAME_Y = 2.2

// Thin dark modern frame (replaces ornate gold)
const borderMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1a, metalness: 0.60, roughness: 0.35 })
const plaqueMat = new THREE.MeshStandardMaterial({ color: 0xd0ccc6, roughness: 0.55, metalness: 0.08 })

function makeFrameBorder() {
  const g = new THREE.Group()
  const d = 0.04, t = 0.038   // t was 0.072 — halved for modern minimal look
  const bar = (bw, bh) => new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), borderMat)
  const top = bar(PAINTING_W + t * 2, t); top.position.set(0, PAINTING_H / 2 + t / 2, 0); g.add(top)
  const bot = bar(PAINTING_W + t * 2, t); bot.position.set(0, -PAINTING_H / 2 - t / 2, 0); g.add(bot)
  const lft = bar(t, PAINTING_H); lft.position.set(-PAINTING_W / 2 - t / 2, 0, 0); g.add(lft)
  const rgt = bar(t, PAINTING_H); rgt.position.set(PAINTING_W / 2 + t / 2, 0, 0); g.add(rgt)
  return g
}

function makePlaceholderCanvas(painting, slot) {
  const canvas = document.createElement('canvas')
  canvas.width = 600; canvas.height = 450
  const ctx = canvas.getContext('2d')
  // Light warm grey background matching gallery walls
  ctx.fillStyle = '#d8d4cc'
  ctx.fillRect(0, 0, 600, 450)
  // Subtle cross-hatch
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'
  ctx.lineWidth = 1
  for (let x = 0; x < 600; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 450); ctx.stroke() }
  for (let y = 0; y < 450; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke() }
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.font = '300 20px serif'
  ctx.fillText(painting.name, 300, 200)
  ctx.font = '13px monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillText('public/paintings/' + slot + '.jpg', 300, 236)
  return canvas
}

export function useGalleryWallPaintings(scene) {
  const count = FAMOUS_PAINTINGS.length
  const loader = new THREE.TextureLoader()
  const textures = []
  const groups = []

  FAMOUS_PAINTINGS.forEach((painting, i) => {
    const slot = String(i + 1).padStart(2, '0')
    const angle = (i / count) * Math.PI * 2 + Math.PI
    const x = Math.sin(angle) * FRAME_RADIUS
    const z = Math.cos(angle) * FRAME_RADIUS

    const group = new THREE.Group()
    group.position.set(x, FRAME_Y, z)
    group.rotation.y = angle + Math.PI

    // Canvas placeholder shown immediately
    const placeholderTex = new THREE.CanvasTexture(makePlaceholderCanvas(painting, slot))
    placeholderTex.encoding = THREE.sRGBEncoding
    textures.push(placeholderTex)

    const paintMat = new THREE.MeshBasicMaterial({ map: placeholderTex })
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(PAINTING_W, PAINTING_H), paintMat)
    paint.position.z = 0.005
    group.add(paint)

    const border = makeFrameBorder()
    border.position.z = 0.01
    group.add(border)

    // Title plaque
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.03), plaqueMat)
    plaque.position.set(0, -PAINTING_H / 2 - 0.2, 0.02)
    group.add(plaque)

    scene.add(group)
    groups.push({ group, paintMat, painting })

    // Load real image, swap texture on success
    loader.setCrossOrigin('anonymous')
    loader.load(
      painting.url,
      (tex) => {
        tex.encoding = THREE.sRGBEncoding
        paintMat.map = tex
        paintMat.needsUpdate = true
        placeholderTex.dispose()
      },
      undefined,
      () => { /* keep placeholder on error */ }
    )
  })

  function disposeAll() {
    groups.forEach(({ group, paintMat }) => {
      scene.remove(group)
      paintMat.map?.dispose()
      paintMat.dispose()
    })
    textures.forEach(t => t.dispose())
    borderMat.dispose()
    plaqueMat.dispose()
  }

  return { disposeAll }
}
