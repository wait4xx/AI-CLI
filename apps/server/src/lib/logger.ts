// pino 8.x CJS export = interop workaround for NodeNext + ESM
import pinoPkg from 'pino'
const pino = pinoPkg as unknown as typeof import('pino') extends { default: infer D } ? D : never
import { getConfig } from './config.js'

// Lazy-initialize logger to avoid calling getConfig() at module load time.
// Tests may set process.env after imports but before calling logger functions.
let _logger: ReturnType<typeof pino> | null = null

function getLogger() {
  if (!_logger) {
    const config = getConfig()
    const isProduction = config.NODE_ENV === 'production'
    _logger = pino({
      level: config.LOG_LEVEL,
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss',
                ignore: 'pid,hostname',
              },
            },
          }),
    })
  }
  return _logger
}

// Export a proxy that delegates to the lazy-initialized logger
// This allows module-level usage like pinoLogger.info() while deferring initialization
export const pinoLogger = new Proxy({} as ReturnType<typeof pino>, {
  get(_target, prop: string) {
    const logger = getLogger()
    const fn = (logger as Record<string, unknown>)[prop]
    return typeof fn === 'function' ? fn.bind(logger) : fn
  },
})
