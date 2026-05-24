import { JwtPayload } from '@ai-cli/shared'

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
  }
}
