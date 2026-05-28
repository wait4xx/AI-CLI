/**
 * Shared WebSocket upgrade authentication helper.
 * Extracts the duplicated JWT verification logic from terminal.ts and control.ts.
 */
import type { FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from '@ai-cli/shared'
import { getConfig } from './config.js'
import { pinoLogger } from './logger.js'

/**
 * Verify JWT token from WebSocket upgrade request query parameters.
 * Closes the socket with code 4001 if token is missing or invalid.
 *
 * @returns The decoded JWT payload, or null if verification failed (socket will be closed)
 */
export function verifyWsUpgradeToken(
  request: FastifyRequest,
  ws: WebSocket,
  channelName: string,
): JwtPayload | null {
  const token = (request.query as Record<string, string | undefined>)?.token
  const secret = getConfig().JWT_SECRET

  if (!token) {
    pinoLogger.warn(`${channelName} WS upgrade rejected — missing token`)
    ws.close(4001, 'Missing token')
    return null
  }

  try {
    return jwt.verify(token, secret) as JwtPayload
  } catch {
    pinoLogger.warn(`${channelName} WS upgrade rejected — invalid token`)
    ws.close(4001, 'Invalid token')
    return null
  }
}
