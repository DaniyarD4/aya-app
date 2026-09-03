import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(path.join(root, '../public/favicon.svg'))
const outDir = path.join(root, '../public/icons')

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path.join(outDir, file))
  console.log('generated', file)
}

// Maskable icon: same mark on a full-bleed accent background with safe-zone padding.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#BD6B4C"/>
  <g transform="translate(32 32) scale(0.7) translate(-32 -32)">
    <path d="M32 16 L47 46 H40.5 L37.5 39.5 H26.5 L23.5 46 H17 Z M32 25.5 L28 33.5 H36 Z" fill="#F7F5F2"/>
  </g>
</svg>`
await sharp(Buffer.from(maskableSvg), { density: 384 })
  .resize(512, 512)
  .png()
  .toFile(path.join(outDir, 'icon-512-maskable.png'))
console.log('generated icon-512-maskable.png')
