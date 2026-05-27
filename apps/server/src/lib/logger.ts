// pino 8.x CJS export = interop workaround for NodeNext + ESM
import pinoPkg from 'pino'
const pino = pinoPkg as unknown as typeof import('pino') extends { default: infer D } ? D : never

const isProduction = process.env.NODE_ENV === 'production'

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
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

export { pinoLogger }
