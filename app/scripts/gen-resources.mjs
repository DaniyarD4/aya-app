import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(path.join(root, '../public/favicon.svg'))
const outDir = path.join(root, '../resources')
mkdirSync(outDir, { recursive: true })

// 1024x1024 источник иконки для @capacitor/assets (генерирует все размеры iOS/Android сам).
await sharp(svg, { density: 1536 }).resize(1024, 1024).png().toFile(path.join(outDir, 'icon.png'))

// Простой сплэш — фон бренда, без лишней графики (премиальный минимализм).
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#F7F5F2"/>
  <g transform="translate(1366 1366) scale(9) translate(-32 -32)">
    <rect width="64" height="64" rx="16" fill="#BD6B4C"/>
    <path d="M32 16 L47 46 H40.5 L37.5 39.5 H26.5 L23.5 46 H17 Z M32 25.5 L28 33.5 H36 Z" fill="#F7F5F2"/>
  </g>
</svg>`
await sharp(Buffer.from(splashSvg)).png().toFile(path.join(outDir, 'splash.png'))
await sharp(Buffer.from(splashSvg)).png().toFile(path.join(outDir, 'splash-dark.png'))

console.log('resources generated')
