// ============================================================
// AI-CLI-Mobile WS 协议类型定义
// ============================================================

// Terminal 通道应用层 Binary 心跳（ADR-014）
// 浏览器 WS API 不支持协议级 Ping/Pong 帧（Opcode 0x9/0xA）
export const TERM_PING = 0x00
export const TERM_PONG = 0x01

// 协议版本号（ADR-020，防止 PWA 静默更新导致版本撕裂）
export const PROTOCOL_VERSION = '0.1.0'

// WS 关闭码
export const WS_CLOSE_CODE = {
  AUTH_FAILED: 4001,
  PROTOCOL_MISMATCH: 4002,
} as const

// Agent 状态定义
export type AgentStatus = 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'ERROR'

// Control Channel 客户端 → 服务端消息
export type ControlClientMessage =
  | { type: 'AUTH'; accessToken: string; protocolVersion: string }
  | { type: 'REFRESH'; refreshToken: string }
  | { type: 'PING' }
  | { type: 'INIT_SESSION'; sessionId: string; cols: number; rows: number; adapter: string }
  | { type: 'ATTACH_SESSION'; sessionId: string }
  | { type: 'RESIZE'; sessionId: string; cols: number; rows: number }
  | { type: 'QUICK_ACTION'; sessionId: string; payload: string }
  | { type: 'INJECT_CODE'; sessionId: string; code: string }

// Control Channel 服务端 → 客户端消息
export type ControlServerMessage =
  | { type: 'AUTH_OK' }
  | { type: 'TOKEN_RENEWED'; accessToken: string }
  | { type: 'PONG' }
  | { type: 'STATUS_UPDATE'; sessionId: string; status: AgentStatus; message?: string }
  | { type: 'SESSION_READY'; sessionId: string }
  | { type: 'ERROR'; message: string }

// JWT Token 对
export interface TokenPair {
  accessToken: string
  refreshToken: string
}

// JWT Payload
export interface JwtPayload {
  userId: string
  username: string
  iat: number
  exp: number
}
