import * as THREE from 'three'
import { loadGLTF } from './useThreeViewer.js'

const FRAME_W = 2.2
const FRAME_H = 1.65
const TARGET_SIZE = 512
const MINI_FPS = 12
const MINI_INTERVAL = 1000 / MINI_FPS
const LOAD_DIST = 16
const UNLOAD_DIST = 28

const borderMat = new THREE.MeshStandardMaterial({ color: 0xc9a84c, metalness: 0.88, roughness: 0.12 })
const _scaleTarget = new THREE.Vector3()

function makeFrameBorder() {
  const g = new THREE.Group()
  const d = 0.05, t = 0.065
  const bar = (bw, bh) => new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), borderMat)
  const top = bar(FRAME_W + t * 2, t); top.position.set(0, FRAME_H / 2 + t / 2, 0); g.add(top)
  const bot = bar(FRAME_W + t * 2, t); bot.position.set(0, -FRAME_H / 2 - t / 2, 0); g.add(bot)
  const lft = bar(t, FRAME_H); lft.position.set(-FRAME_W / 2 - t / 2, 0, 0); g.add(lft)
  const rgt = bar(t, FRAME_H); rgt.position.set(FRAME_W / 2 + t / 2, 0, 0); g.add(rgt)
  return g
}

export function useGalleryFrames(mainScene, works, framePositions, renderer) {
  const frameData = framePositions.map((fp, i) => {
    const group = new THREE.Group()
    group.position.copy(fp.position)
    group.rotation.y = fp.rotationY

    const target = new THREE.WebGLRenderTarget(TARGET_SIZE, Math.round(TARGET_SIZE * FRAME_H / FRAME_W), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    })
    target.texture.encoding = THREE.sRGBEncoding

    const paintMat = new THREE.MeshBasicMaterial({ map: target.texture })
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(FRAME_W, FRAME_H), paintMat)
    paint.position.z = 0.005
    group.add(paint)

    const border = makeFrameBorder()
    border.position.z = 0.01
    group.add(border)

    const plaqueMat = new THREE.MeshStandardMaterial({ color: 0xd4cfc6, roughness: 0.55, metalness: 0.12 })
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.03), plaqueMat)
    plaque.position.set(0, -FRAME_H / 2 - 0.18, 0.02)
    group.add(plaque)

    mainScene.add(group)

    const miniScene = new THREE.Scene()
    miniScene.background = new THREE.Color(0x111111)
    const miniCamera = new THREE.PerspectiveCamera(42, FRAME_W / FRAME_H, 0.01, 100)

    const key = new THREE.DirectionalLight(0xffffff, 3.5); key.position.set(-3, 5, 4); miniScene.add(key)
    const fill = new THREE.DirectionalLight(0xeef2ff, 0.5); fill.position.set(4, 2, -3); miniScene.add(fill)
    miniScene.add(new THREE.AmbientLight(0xffffff, 0.3))

    return {
      group, paint, border, target, miniScene, miniCamera,
      modelGroup: null,
      state: 'empty',
      workIndex: i,
      lastRender: 0,
      rotSpeed: 0.18 + Math.random() * 0.14,
    }
  })

  let hoveredIdx = -1

  function setHovered(idx) { hoveredIdx = idx }

  async function loadFrame(fd) {
    if (fd.state !== 'empty') return
    fd.state = 'loading'
    try {
      const gltf = await loadGLTF(works[fd.workIndex].url)
      const model = gltf.scene.clone(true)

      model.traverse(child => {
        if (!child.isMesh) return
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m ? m.clone() : m)
        } else if (child.material) {
          child.material = child.material.clone()
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach(mat => {
          if (!mat) return
          if (mat.transmission > 0 || mat.opacity < 0.99) { mat.transparent = true; mat.depthWrite = false }
          mat.needsUpdate = true
        })
      })

      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const s = 1.1 / maxDim
      model.scale.setScalar(s)
      model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(s))

      const mg = new THREE.Group()
      mg.add(model)
      fd.miniScene.add(mg)
      fd.modelGroup = mg

      const camDist = (1.1 / (2 * Math.tan(THREE.MathUtils.degToRad(21)))) * 1.4
      fd.miniCamera.position.set(0, size.y * s * 0.08, camDist)
      fd.miniCamera.lookAt(0, 0, 0)

      fd.state = 'loaded'
    } catch (e) {
      console.error('Gallery frame load error:', works[fd.workIndex]?.url, e)
      fd.state = 'empty'
    }
  }

  function unloadFrame(fd) {
    if (!fd.modelGroup) return
    fd.miniScene.remove(fd.modelGroup)
    fd.modelGroup.traverse(c => {
      if (c.geometry) c.geometry.dispose()
      const mats = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : []
      mats.forEach(m => m && m.dispose())
    })
    fd.modelGroup = null
    fd.state = 'empty'
  }

  function updateVisibility(camPos) {
    frameData.forEach(fd => {
      const d = fd.group.position.distanceTo(camPos)
      if (d < LOAD_DIST && fd.state === 'empty') loadFrame(fd)
      else if (d > UNLOAD_DIST && fd.state === 'loaded') unloadFrame(fd)
    })
  }

  function tick(delta) {
    frameData.forEach((fd, i) => {
      if (fd.modelGroup) fd.modelGroup.rotation.y += delta * fd.rotSpeed

      const targetScale = (i === hoveredIdx) ? 1.02 : 1.0
      _scaleTarget.setScalar(targetScale)
      fd.border.scale.lerp(_scaleTarget, 0.1)
    })
  }

  function renderToTargets(time) {
    const savedTM = renderer.toneMapping
    renderer.toneMapping = THREE.NoToneMapping
    frameData.forEach(fd => {
      if (fd.state !== 'loaded') return
      if (time - fd.lastRender < MINI_INTERVAL) return
      fd.lastRender = time
      renderer.setRenderTarget(fd.target)
      renderer.render(fd.miniScene, fd.miniCamera)
    })
    renderer.setRenderTarget(null)
    renderer.toneMapping = savedTM
  }

  function getPaints() { return frameData.map(fd => fd.paint) }

  function disposeAll() {
    frameData.forEach(fd => { unloadFrame(fd); fd.target.dispose(); mainScene.remove(fd.group) })
    borderMat.dispose()
  }

  return { updateVisibility, tick, renderToTargets, getPaints, setHovered, disposeAll }
}
