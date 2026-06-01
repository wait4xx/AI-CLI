import { useState, memo } from 'react'
import { Terminal } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 6

export const LoginForm = memo(function LoginForm({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
    <div className="relative flex items-center justify-center h-full w-full overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />

      {/* Animated orbs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-600/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

      {/* Glass card */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-80 rounded-2xl p-8 space-y-6
                   bg-white/[0.08] backdrop-blur-xl border border-white/[0.12]
                   shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Terminal className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">AI CLI</h1>
          <p className="text-xs text-white/40 -mt-2">Mobile Development Gateway</p>
        </div>

        {error && (
          <p className="text-red-400 text-xs text-center bg-red-500/10 rounded-lg py-2 px-3 border border-red-500/20">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <input
            type="text"
            aria-label="用户名"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1]
                       text-white text-sm placeholder-white/30
                       focus:outline-none focus:border-blue-400/50 focus:bg-white/[0.1]
                       transition-all duration-200"
            autoComplete="username"
          />
          <input
            type="password"
            aria-label="密码"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1]
                       text-white text-sm placeholder-white/30
                       focus:outline-none focus:border-blue-400/50 focus:bg-white/[0.1]
                       transition-all duration-200"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold
                     bg-gradient-to-r from-blue-600 to-purple-600
                     hover:from-blue-500 hover:to-purple-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40
                     transition-all duration-200 active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              登录中...
            </span>
          ) : (
            '登录'
          )}
        </button>
      </form>
    </div>
  )
})
