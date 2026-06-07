export const GALLERY_LAYOUT = [
  // FRAMES (8) — 掛牆畫框 render-to-texture
  { name: 'Golden Snitch',            type: 'frame' },
  { name: 'TAIPEI 101',               type: 'frame' },
  { name: 'LAWSON 富士河口湖町役場前店', type: 'frame' },
  { name: '書架',                     type: 'frame' },
  { name: '火車',                     type: 'frame' },
  { name: '幾何圖騰練習',              type: 'frame' },
  { name: '矩陣圖騰練習',              type: 'frame' },
  { name: '線段圖騰練習',              type: 'frame' },
  // PEDESTALS (10) — 中央雕塑台座
  // desc 欄位會在聚焦時顯示於畫面下方，可自行修改說明文字
  { name: 'i16 miffy 手機殼',         type: 'pedestal', desc: 'Rhino 3D 建模・FDM 列印・產品設計課程作業' },
  { name: 'i16 手機',                type: 'pedestal', desc: 'Rhino 3D 建模・iPhone 16 尺寸仿製練習' },
  { name: 'miffy 雨天玩偶設計',       type: 'pedestal', desc: 'Rhino 3D 建模・角色造型延伸設計' },
  { name: 'ntue 陰刻陽刻印章',        type: 'pedestal', desc: 'Rhino 3D 建模・傳統印章工藝數位轉化' },
  { name: '機構練習',                type: 'pedestal', desc: 'Rhino 3D 建模・活動關節機構設計練習' },
  { name: '滑鼠殼',                 type: 'pedestal', desc: 'Rhino 3D 建模・人因工程外殼造型設計' },
  { name: '肥皂架 1',                type: 'pedestal', desc: 'Rhino 3D 建模・衛浴用品造型設計' },
  { name: '肥皂盒 2',                type: 'pedestal', desc: 'Rhino 3D 建模・衛浴用品造型設計' },
  { name: '馬克杯',                 type: 'pedestal', desc: 'Rhino 3D 建模・日用品造型練習' },
  { name: '骰子',                   type: 'pedestal', desc: 'Rhino 3D 建模・幾何造型基礎練習' },
]

export const ROOM_RADIUS     = 10
export const FRAME_RADIUS    = 9.6
export const PEDESTAL_RADIUS = 5.5
export const PEDESTAL_HEIGHT = 0.9

export const frameWorks    = GALLERY_LAYOUT.filter(e => e.type === 'frame')
export const pedestalWorks = GALLERY_LAYOUT.filter(e => e.type === 'pedestal')
