import { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@ai-cli/shared'
import { WSGateway } from '../core/WSGateway.js'
import { pinoLogger } from '../lib/logger.js'

export async function controlRoutes(fastify: FastifyInstance) {
  // [W13修复] 在 WS upgrade 阶段验证 JWT token
  fastify.get('/ws/control', {
    websocket: true,
  }, (connection, request) => {
    // 从 query 参数获取 token（WebSocket 握手阶段无法使用 Authorization header）
    const token = (request.query as any)?.token
    if (!token || !process.env.JWT_SECRET) {
      pinoLogger.warn('Control WS upgrade rejected — missing token')
      connection.socket.close(4001, 'Missing token')
      return
    }
    try {
      jwt.verify(token, process.env.JWT_SECRET) as JwtPayload
    } catch {
      pinoLogger.warn('Control WS upgrade rejected — invalid token')
      connection.socket.close(4001, 'Invalid token')
      return
    }

    const gateway = (fastify as any).wsGateway as WSGateway
    gateway.handleControlConnection(connection.socket)
  })
}
