// 捕获 Claude Code headless stream-json 样本,过滤超长 system 行,只保留
// assistant/user/result 事件,作为解析器测试 fixture。用法: node capture.mjs
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'

const out = createWriteStream(new URL('./claude-stream-sample.jsonl', import.meta.url))
const args = [
  '-p',
  '--output-format', 'stream-json',
  '--include-partial-messages',
  '--verbose',
  '--permission-mode', 'acceptEdits',
]
const child = spawn('claude', args, { cwd: process.cwd() })
child.stdin.write('Read the file package.json and list its top-level keys as a one-line summary.\n')
child.stdin.end()

let kept = 0
child.stdout.on('data', (chunk) => {
  for (const line of chunk.toString().split('\n')) {
    if (!line.startsWith('{')) continue
    if (line.length > 2000) continue
    try {
      const ev = JSON.parse(line)
      if (!['assistant', 'user', 'result'].includes(ev.type)) continue
      out.write(line + '\n')
      kept++
    } catch {
      /* 非 JSON 行,丢弃 */
    }
  }
})
child.on('close', () => {
  out.end()
  console.log(`captured ${kept} lines`)
})
child.on('error', (e) => { console.error('spawn error', e.message); process.exit(1) })
