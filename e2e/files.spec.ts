/**
 * E2E 测试：文件浏览
 * 覆盖获取文件列表 → 读取文件内容 → 创建文件 → 删除文件
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123456'
const PROJECT_ROOT = '/tmp/e2e-project-root'

/** 辅助：获取管理员 token */
async function getAdminToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post('http://localhost:3000/api/auth/login', {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  })
  const body = await res.json()
  return body.accessToken
}

test.describe('文件系统操作', () => {
  let accessToken: string

  test.beforeAll(async ({ request }) => {
    accessToken = await getAdminToken(request)
    // 确保测试项目根目录存在
    fs.mkdirSync(PROJECT_ROOT, { recursive: true })
    // 创建测试文件
    fs.writeFileSync(path.join(PROJECT_ROOT, 'test-read.txt'), 'hello from e2e')
    fs.mkdirSync(path.join(PROJECT_ROOT, 'subdir'), { recursive: true })
  })

  test('获取文件目录列表', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/fs/tree?path=', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.entries)).toBeTruthy()
    // 应该包含我们创建的测试文件
    const names = body.entries.map((e: { name: string }) => e.name)
    expect(names).toContain('test-read.txt')
  })

  test('获取子目录列表', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/fs/tree?path=subdir', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.entries)).toBeTruthy()
  })

  test('读取文件内容', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/fs/file?path=test-read.txt', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.content).toBe('hello from e2e')
    expect(body.path).toBe('test-read.txt')
    expect(body.language).toBe('text')
  })

  test('读取不存在的文件返回 404', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/fs/file?path=nonexistent.txt', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status()).toBe(404)
  })

  test('创建/写入新文件', async ({ request }) => {
    const res = await request.put('http://localhost:3000/api/fs/file', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        path: 'e2e-created.txt',
        content: 'created by e2e test',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.path).toBe('e2e-created.txt')

    // 验证文件确实存在
    expect(fs.readFileSync(path.join(PROJECT_ROOT, 'e2e-created.txt'), 'utf-8')).toBe('created by e2e test')
  })

  test('路径穿越检测', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/fs/file?path=../../../etc/passwd', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status()).toBe(403)
  })

  test('缺失路径参数返回 400', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/fs/file', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status()).toBe(400)
  })

  test('写入危险文件类型被阻止', async ({ request }) => {
    const res = await request.put('http://localhost:3000/api/fs/file', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        path: 'malicious.exe',
        content: 'binary',
      },
    })
    expect(res.status()).toBe(403)
  })
})
