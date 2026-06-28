import { JwtPayload } from '@ai-cli/shared'
import type { WSGateway } from '../core/WSGateway.js'
import type { SessionManager } from '../core/SessionManager.js'
import type { ChatGateway } from '../chat/ChatGateway.js'
import type { ConversationManager } from '../chat/ConversationManager.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
  }

  // [R9] Type-safe decoration for wsGateway
  interface FastifyInstance {
    wsGateway: WSGateway
    sessionManager: SessionManager
    chatGateway: ChatGateway
    conversationManager: ConversationManager
  }
}
