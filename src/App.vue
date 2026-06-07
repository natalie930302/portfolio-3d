<template>
  <GalleryScene v-if="works.length" :works="works" />
  <div v-if="dragging" class="drop-overlay">放開以匯入</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import GalleryScene from './components/GalleryScene.vue'
import { GALLERY_LAYOUT } from './data/galleryLayout.js'

const works = ref([])
const dragging = ref(false)
const fileNames = new Set()

onMounted(async () => {
  try {
    const res = await fetch('/manifest.json')
    if (!res.ok) return
    const manifest = await res.json()

    if (manifest.models?.length) {
      manifest.models.forEach(url => {
        const name = url.split('/').pop().replace(/\.(glb|gltf)$/i, '')
        if (fileNames.has(name)) return
        fileNames.add(name)
        const desc = GALLERY_LAYOUT.find(e => e.name === name)?.desc ?? ''
        works.value.push({ name, url, desc })
      })
    }
  } catch (e) {
    console.warn('manifest.json 未找到')
  }
})

function addFiles(files) {
  ;[...files]
    .filter(f => /\.(glb|gltf)$/i.test(f.name) && !fileNames.has(f.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(f => {
      fileNames.add(f.name)
      const name = f.name.replace(/\.(glb|gltf)$/i, '')
      const desc = GALLERY_LAYOUT.find(e => e.name === name)?.desc ?? ''
      works.value.push({ name, url: URL.createObjectURL(f), desc })
    })
}

let dragCount = 0
window.addEventListener('dragenter', e => { if (!e.dataTransfer.types.includes('Files')) return; dragCount++; dragging.value = true })
window.addEventListener('dragleave', () => { dragCount--; if (dragCount <= 0) { dragCount = 0; dragging.value = false } })
window.addEventListener('dragover', e => e.preventDefault())
window.addEventListener('drop', e => { e.preventDefault(); dragCount = 0; dragging.value = false; addFiles(e.dataTransfer.files) })
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;600&family=Space+Mono:wght@400;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d0c0b; color: #fff; font-family: 'Noto Serif TC', serif; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.25rem; padding: 7rem 2rem; text-align: center; min-height: 100vh; }
.empty-icon { font-size: 3rem; opacity: .25; }
.empty-title { font-size: 1.1rem; font-weight: 300; color: rgba(255,255,255,.7); }
.empty-sub { font-family: 'Space Mono', monospace; font-size: .65rem; color: rgba(255,255,255,.35); line-height: 2.2; }
code { font-family: 'Space Mono', monospace; font-size: .85em; background: rgba(255,255,255,.1); padding: .1em .35em; border-radius: 3px; }

.drop-overlay { position: fixed; inset: 0; background: rgba(30,30,30,.85); z-index: 200; display: flex; align-items: center; justify-content: center; font-family: 'Space Mono', monospace; font-size: 1rem; color: #fff; letter-spacing: .1em; }
</style>
