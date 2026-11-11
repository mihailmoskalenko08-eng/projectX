// Рисует PNG-иконки из SVG: npm run icons
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  const jobs = [
    ['scripts/icon-full.svg', 180, 'public/icons/apple-touch-icon.png'],
    ['scripts/icon-full.svg', 192, 'public/icons/icon-192.png'],
    ['scripts/icon-full.svg', 512, 'public/icons/icon-512.png'],
    ['scripts/icon-maskable.svg', 512, 'public/icons/icon-maskable-512.png']
  ]
  for (const [src, size, out] of jobs) {
    await p.setViewportSize({ width: size, height: size })
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${readFileSync(src, 'utf8')}`)
    await p.screenshot({ path: out })
  }
  await b.close()
  console.log('ok')
})()
