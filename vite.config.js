import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

// Vite plugin：掃描 public/models 和 public/env，生成 manifest.json
function publicFolderManifest() {
  return {
    name: 'public-folder-manifest',
    buildStart() {
      writeManifest()
    },
    configureServer(server) {
      // dev 模式：每次有請求 manifest.json 時重新掃描
      server.middlewares.use('/manifest.json', (req, res) => {
        const manifest = scanFolders()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(manifest))
      })
    }
  }
}

function scanFolders() {
  const root = path.resolve(__dirname, 'public')

  function listFiles(dir, exts) {
    const full = path.join(root, dir)
    if (!fs.existsSync(full)) return []
    return fs.readdirSync(full)
      .filter(f => exts.some(e => f.toLowerCase().endsWith(e)))
      .sort()
      .map(f => `/${dir}/${f}`)
  }

  return {
    models: listFiles('models', ['.glb', '.gltf']),
    env: listFiles('env', ['.jpg', '.jpeg', '.png', '.webp']),
  }
}

function writeManifest() {
  const manifest = scanFolders()
  const out = path.resolve(__dirname, 'public/manifest.json')
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2))
  console.log('[manifest] models:', manifest.models.length, '| env:', manifest.env.length)
}

export default defineConfig({
  plugins: [vue(), publicFolderManifest()],
})
