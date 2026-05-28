import { JwtPayload } from '@ai-cli/shared'
import type { WSGateway } from '../core/WSGateway.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
  }

  // [R9] Type-safe decoration for wsGateway
  interface FastifyInstance {
    wsGateway: WSGateway
  }
}
