import { FastifyInstance } from 'fastify'
import { WSGateway } from '../core/WSGateway.js'

export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/terminal', { websocket: true }, (connection, _request) => {
    const gateway = (fastify as any).wsGateway as WSGateway
    gateway.handleTerminalConnection(connection.socket)
  })
}
