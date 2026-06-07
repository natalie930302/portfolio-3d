import * as THREE from 'three'
import { loadGLTF } from './useThreeViewer.js'
import { PEDESTAL_HEIGHT } from '../data/galleryLayout.js'

const BOB_AMP   = 0.025
const BOB_OMEGA = (Math.PI * 2) / 4  // gentle 4-second cycle

// Concrete-toned pedestals to match gallery aesthetic
const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2c2926, roughness: 0.75, metalness: 0.04 })
const capMat    = new THREE.MeshStandardMaterial({ color: 0x363230, roughness: 0.65, metalness: 0.06 })

const _scaleTarget = new THREE.Vector3()

function computePedestalPositions(count) {
  const INNER_R = 3.2
  const OUTER_R = 5.8
  const split = Math.ceil(count / 2)

  return Array.from({ length: count }, (_, i) => {
    const isInner = i < split
    const ringCount = isInner ? split : count - split
    const ringIdx   = isInner ? i : i - split
    const radius    = isInner ? INNER_R : OUTER_R
    const offset    = isInner ? 0 : (Math.PI / ringCount)
    const angle     = (ringIdx / ringCount) * Math.PI * 2 + offset
    return {
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius,
      rotationY: angle + Math.PI,
    }
  })
}

function makePlinth(idx) {
  const group = new THREE.Group()
  group.userData.pedestalIdx = idx

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.26, PEDESTAL_HEIGHT, 16),
    plinthMat
  )
  plinth.position.y = PEDESTAL_HEIGHT / 2
  plinth.userData.pedestalIdx = idx
  group.add(plinth)

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.20, 0.04, 16),
    capMat
  )
  cap.position.y = PEDESTAL_HEIGHT + 0.02
  cap.userData.pedestalIdx = idx
  group.add(cap)

  const modelGroup = new THREE.Group()
  // Lift model higher above cap so it doesn't clip pedestal during rotation
  modelGroup.position.y = PEDESTAL_HEIGHT + 0.22
  group.add(modelGroup)

  return { group, plinth, cap, modelGroup }
}

export function useGalleryPedestals(mainScene, works) {
  const positions = computePedestalPositions(works.length)

  const pedestalData = works.map((work, i) => {
    const { group, plinth, cap, modelGroup } = makePlinth(i)
    const pos = positions[i]
    group.position.set(pos.x, 0, pos.z)
    group.rotation.y = pos.rotationY
    mainScene.add(group)

    // Individual spotlight above each pedestal — creates pool-of-light effect
    const accentLight = new THREE.PointLight(0xfff8f0, 1.5, 3.4)
    accentLight.position.set(pos.x, PEDESTAL_HEIGHT + 2.6, pos.z)
    mainScene.add(accentLight)

    return {
      work,
      group, plinth, cap, modelGroup,
      accentLight,
      model: null,
      state: 'empty',
      bobOffset: Math.random() * Math.PI * 2,
    }
  })

  let hoveredIdx = -1
  let focusedIdx = -1

  function setHovered(idx) { hoveredIdx = idx }

  function setFocused(idx) {
    if (focusedIdx >= 0 && focusedIdx < pedestalData.length) {
      pedestalData[focusedIdx].plinth.visible = true
      pedestalData[focusedIdx].cap.visible = true
    }
    focusedIdx = idx
    if (idx >= 0 && idx < pedestalData.length) {
      pedestalData[idx].plinth.visible = false
      pedestalData[idx].cap.visible = false
    }
  }

  async function loadPedestal(pd) {
    if (pd.state !== 'empty') return
    pd.state = 'loading'
    try {
      const gltf = await loadGLTF(pd.work.url)
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
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      // Smaller scale so model fits well above pedestal without clipping
      const s = 0.52 / maxDim
      model.scale.setScalar(s)
      const center = box.getCenter(new THREE.Vector3())
      model.position.x = -center.x * s
      model.position.z = -center.z * s
      // -min.y * s lifts bottom to local y=0; +0.08 is a safety margin for complex GLTF transforms
      model.position.y = -box.min.y * s + 0.08

      // Cache model center (modelGroup local Y) for focus camera — avoids Box3 at click time
      pd.modelGroup.userData.focusCenterLocalY = model.position.y + size.y * s / 2

      pd.modelGroup.add(model)
      pd.model = model
      pd.state = 'loaded'
    } catch (e) {
      console.error('Pedestal load error:', pd.work?.url, e)
      pd.state = 'empty'
    }
  }

  // Base Y position for modelGroup (before bob offset)
  const MODEL_BASE_Y = PEDESTAL_HEIGHT + 0.22

  function update(delta, time) {
    pedestalData.forEach((pd, i) => {
      if (pd.state === 'loaded' && i !== focusedIdx) {
        // Gentle floating bob — suppressed while focused
        pd.modelGroup.position.y =
          MODEL_BASE_Y + Math.sin(time * 0.001 * BOB_OMEGA + pd.bobOffset) * BOB_AMP
      }

      // Hover scale on whole pedestal group
      const targetScale = (i === hoveredIdx) ? 1.02 : 1.0
      _scaleTarget.setScalar(targetScale)
      pd.group.scale.lerp(_scaleTarget, 0.1)
    })
  }

  function getPedestalGroups()  { return pedestalData.map(pd => pd.group) }
  function getModelGroups()     { return pedestalData.map(pd => pd.modelGroup) }
  function getPedestalPositions() {
    return pedestalData.map(pd => ({ x: pd.group.position.x, z: pd.group.position.z }))
  }

  function loadAll() { pedestalData.forEach(pd => loadPedestal(pd)) }

  function disposeAll() {
    pedestalData.forEach(pd => {
      if (pd.model) {
        pd.model.traverse(c => {
          c.geometry?.dispose()
          const mats = c.material ? (Array.isArray(c.material) ? c.material : [c.material]) : []
          mats.forEach(m => m?.dispose())
        })
      }
      mainScene.remove(pd.group)
      mainScene.remove(pd.accentLight)
    })
    plinthMat.dispose()
    capMat.dispose()
  }

  return { update, getPedestalGroups, getModelGroups, getPedestalPositions, setHovered, setFocused, loadAll, disposeAll }
}
