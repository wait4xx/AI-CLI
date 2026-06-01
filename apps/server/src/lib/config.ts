/**
 * [M14修复] 环境变量 schema 验证
 * 使用 zod 在启动时校验所有必需和可选的环境变量，
 * 确保配置错误在启动阶段即被捕获，而非运行时才发现。
 */
import path from 'path'
import { z } from 'zod/v4'

const configSchema = z.object({
  // ─── 必需 ───
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // ─── 可选（带默认值）───
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(18333),
  PROJECT_ROOT: z.string().default('/workspace'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z
    .union([z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'), z.literal('')])
    .optional(),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SHELL_CMD: z.string().default('bash'),
  DATA_DIR: z.string().default(() => path.join(process.cwd(), 'data')),
  FS_ALLOW_ABSOLUTE_PATHS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

export type AppConfig = z.infer<typeof configSchema>

/**
 * 校验环境变量并返回类型安全的配置对象。
 * 校验失败时抛出明确的错误信息，列出所有不合规的字段。
 */
export function validateConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    const errors = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Environment variable validation failed:\n${errors}`)
  }
  return result.data
}

/**
 * 全局配置单例。
 * 模块首次 import 时自动校验，后续调用直接返回缓存结果。
 * 在测试环境下，每次调用都重新解析，以支持测试文件动态修改 process.env。
 */
let _config: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!_config || process.env.NODE_ENV === 'test') {
    _config = validateConfig()
  }
  return _config
}

/**
 * Reset the cached config. Useful in tests when environment changes.
 */
export function resetConfig(): void {
  _config = null
}
