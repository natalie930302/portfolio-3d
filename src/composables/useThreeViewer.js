import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const _gltfCache = new Map()

export function loadGLTF(url) {
  if (_gltfCache.has(url)) return _gltfCache.get(url)
  const p = new Promise((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject)
  })
  _gltfCache.set(url, p)
  return p
}

function setupRenderer(renderer) {
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.physicallyCorrectLights = true
}

export function useThreeViewer(container, url, options = {}) {
  const { autoRotate = false, onLoad } = options

  const w = container.clientWidth || 400
  const h = container.clientHeight || 300

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  setupRenderer(renderer)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1a)

  const camera = new THREE.PerspectiveCamera(42, w / h, 0.0001, 1000)

  const key = new THREE.DirectionalLight(0xffffff, 3.5)
  key.position.set(-3, 5, 4); scene.add(key)
  const fill = new THREE.DirectionalLight(0xeef2ff, 0.4)
  fill.position.set(4, 2, -3); scene.add(fill)
  scene.add(new THREE.AmbientLight(0xffffff, 0.25))

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.autoRotate = autoRotate
  controls.autoRotateSpeed = 0.8
  controls.minPolarAngle = 0.05
  controls.maxPolarAngle = Math.PI * 0.9

  let animId = null
  let animRunning = false
  const frameInterval = autoRotate ? 1000 / 20 : 0
  let lastFrameTime = 0

  const tick = (time = 0) => {
    if (!animRunning) return
    animId = requestAnimationFrame(tick)
    if (time - lastFrameTime < frameInterval) return
    lastFrameTime = time
    controls.update()
    renderer.render(scene, camera)
  }

  function startLoop() {
    if (animRunning) return
    animRunning = true
    requestAnimationFrame(tick)
  }

  function stopLoop() {
    animRunning = false
    cancelAnimationFrame(animId)
    animId = null
  }

  startLoop()

  const ro = new ResizeObserver(() => {
    const w2 = container.clientWidth, h2 = container.clientHeight
    if (!w2 || !h2) return
    camera.aspect = w2 / h2
    camera.updateProjectionMatrix()
    renderer.setSize(w2, h2, false)
  })
  ro.observe(container)

  const self = {
    pause() { stopLoop() },
    resume() { startLoop() },
    dispose() {
      ro.disconnect()
      stopLoop()
      renderer.dispose()
    }
  }

  loadGLTF(url).then(gltf => {
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
        if (mat.transmission > 0 || mat.opacity < 0.99) {
          mat.transparent = true; mat.depthWrite = false
        }
        mat.needsUpdate = true
      })
    })

    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const s = 1.6 / maxDim
    model.scale.setScalar(s)
    model.position.sub(center.multiplyScalar(s))
    scene.add(model)

    const dist = maxDim * s * 2.2
    camera.position.set(dist * 0.5, dist * 0.35, dist)
    controls.target.set(0, size.y * s * 0.15, 0)
    controls.update()

    renderer.render(scene, camera)
    onLoad?.()
  }).catch(err => console.error('GLTF error:', url, err))

  return self
}

export function preloadModel(url) {
  loadGLTF(url)
}
