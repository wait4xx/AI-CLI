import { FastifyInstance } from 'fastify'
import { WSGateway } from '../core/WSGateway.js'

export async function controlRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/control', { websocket: true }, (connection, _request) => {
    const gateway = (fastify as any).wsGateway as WSGateway
    gateway.handleControlConnection(connection.socket)
  })
}
