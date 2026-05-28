import { useState, memo } from 'react'

// [L5修复] 密码最小长度从常量导入
const MIN_PASSWORD_LENGTH = 6

export const LoginForm = memo(function LoginForm({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // 安全修复[W29]: 密码最小长度校验
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位`)
      return
    }
    setLoading(true)
    try {
      await onLogin(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <form onSubmit={handleSubmit} className="w-72 space-y-4">
        <h1 className="text-xl font-semibold text-gray-100 text-center">AI CLI Mobile</h1>
        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 rounded bg-dark-surface border border-dark-border text-gray-100 text-sm focus:outline-none focus:border-blue-500"
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-dark-surface border border-dark-border text-gray-100 text-sm focus:outline-none focus:border-blue-500"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
})