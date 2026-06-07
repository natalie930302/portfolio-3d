# 3D 作品集 — Vue + Vite

## 安裝與啟動

```bash
npm install
npm run dev
```

瀏覽器開啟 http://localhost:5173

## 📁 放檔案的方式（最方便）

直接把檔案丟進資料夾，重新整理頁面就自動出現：

```
public/
├── models/          ← 把你的 .glb / .gltf 放這裡
│   ├── 作業.glb
│   ├── 圖騰練習.glb
│   └── ...
└── env/             ← 把 360° 全景圖放這裡
    ├── studio.jpg
    └── ...
```

- `models/` 裡的模型會在啟動時自動全部載入
- `env/` 裡有多張環境圖時，右上角會出現**快選下拉選單**
- 第一張環境圖會自動套用

## 其他載入方式

- **開啟資料夾**：選任意資料夾，裡面的 GLB/GLTF 全部載入
- **加入檔案**：補充單獨幾個檔案
- **拖曳**：直接把檔案拖進瀏覽器視窗

## 打包部署

```bash
npm run build
```

輸出在 `dist/` 資料夾。

## 專案結構

```
src/
├── composables/
│   └── useThreeViewer.js   # Three.js 核心（燈光/材質/環境圖）
├── components/
│   ├── ModelViewer.vue     # 單一 3D canvas
│   ├── WorkCard.vue        # 作品卡片
│   └── ModelModal.vue      # 放大視窗
└── App.vue                 # 主介面

public/
├── models/                 # ← 放你的模型
└── env/                    # ← 放環境圖
```
