#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public')

mkdirSync(publicDir, { recursive: true })

function createPNG(width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 2   // RGB
  const ihdr = makeChunk('IHDR', ihdrData)

  // Image data: concentric circle terminal icon
  const rowLen = 1 + width * 3
  const rawData = Buffer.alloc(rowLen * height)
  for (let y = 0; y < height; y++) {
    const offset = y * rowLen
    rawData[offset] = 0 // no filter
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3
      const cx = width / 2, cy = height / 2
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      const maxDist = Math.sqrt(cx * cx + cy * cy)
      const t = dist / maxDist

      if (t < 0.3) {
        // Inner: accent (#6366f1)
        rawData[px] = 99; rawData[px + 1] = 102; rawData[px + 2] = 241
      } else if (t < 0.6) {
        // Middle: surface (#1a1a2e)
        rawData[px] = 26; rawData[px + 1] = 26; rawData[px + 2] = 46
      } else {
        // Outer: bg (#0f0f1a)
        rawData[px] = 15; rawData[px + 1] = 15; rawData[px + 2] = 26
      }
    }
  }

  const compressed = deflateSync(rawData)
  const idat = makeChunk('IDAT', compressed)
  const iend = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type)
  const crcInput = Buffer.concat([typeB, data])
  const crc = crc32(crcInput)
  const crcB = Buffer.alloc(4)
  crcB.writeUInt32BE(crc >>> 0)
  return Buffer.concat([len, typeB, data, crcB])
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
    }
  }
  return c ^ 0xffffffff
}

writeFileSync(join(publicDir, 'icon-192.png'), createPNG(192, 192))
writeFileSync(join(publicDir, 'icon-512.png'), createPNG(512, 512))

console.log('Generated PWA icons in', publicDir)
