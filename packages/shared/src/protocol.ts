// ============================================================
// AI-CLI-Mobile WS 协议类型定义
// ============================================================

// Terminal 通道应用层 Binary 心跳（ADR-014）
export const TERM_PING = 0x00 // 客户端 → 服务端心跳探测
export const TERM_PONG = 0x01 // 服务端 → 客户端心跳响应（回复客户端 PING）
export const TERM_SERVER_PING = 0x02 // 服务端 → 客户端探活（独立于客户端 PING/PONG，消除协议歧义）

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
  | {
      type: 'INIT_SESSION'
      sessionId: string
      cols: number
      rows: number
      adapter: string
      attachToTmux?: string
      cwd?: string
    }
  | { type: 'ATTACH_SESSION'; sessionId: string }
  | { type: 'RESIZE'; sessionId: string; cols: number; rows: number }
  | { type: 'QUICK_ACTION'; sessionId: string; payload: string }
  | { type: 'INJECT_CODE'; sessionId: string; code: string }
  | { type: 'START_RECORDING'; sessionId: string }
  | { type: 'STOP_RECORDING'; sessionId: string }
  | { type: 'GET_RECORDING'; sessionId: string; startTime?: number; endTime?: number }
  | { type: 'OBSERVE_SESSION'; sessionId: string }
  | { type: 'SELECT_PANE'; sessionId: string; paneIndex: number }
  | { type: 'LIST_PANES'; sessionId: string }
  // Multi-device control
  | { type: 'REQUEST_CONTROL'; sessionId: string }
  | { type: 'GRANT_CONTROL'; sessionId: string; requestId: string }
  | { type: 'DENY_CONTROL'; sessionId: string; requestId: string }
  | { type: 'FORCE_TAKE_CONTROL'; sessionId: string }
  // Session sharing
  | {
      type: 'SHARE_SESSION'
      sessionId: string
      targetUsername: string
      permission: 'read' | 'write'
    }
  | { type: 'UNSHARE_SESSION'; sessionId: string; targetUsername: string }
  | { type: 'REQUEST_WRITE'; sessionId: string }

// Control Channel 服务端 → 客户端消息
export type ControlServerMessage =
  | { type: 'AUTH_OK' }
  | { type: 'TOKEN_RENEWED'; accessToken: string }
  | { type: 'PONG' }
  | {
      type: 'STATUS_UPDATE'
      sessionId: string
      status: AgentStatus
      message?: string
      options?: Array<{ label: string; payload: string }>
    }
  | { type: 'SESSION_READY'; sessionId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RECORDING_DATA'; sessionId: string; data: Array<{ data: string; timestamp: number }> }
  | { type: 'RECORDING_STATUS'; sessionId: string; recording: boolean; duration: number }
  | { type: 'SESSION_DESTROYED'; sessionId: string }
  | { type: 'FILE_CHANGED'; path: string; oldContent: string; newContent: string }
  | {
      type: 'PANE_INFO'
      sessionId: string
      panes: Array<{ index: number; title: string; active: boolean; command: string }>
    }
  // Multi-device control
  | { type: 'OBSERVER_MODE'; sessionId: string; isObserver: boolean }
  | {
      type: 'CONTROL_REQUESTED'
      sessionId: string
      requestId: string
      deviceName: string
      username: string
    }
  | { type: 'CONTROL_GRANTED'; sessionId: string }
  | { type: 'CONTROL_REVOKED'; sessionId: string; reason?: string }
  | {
      type: 'DEVICE_LIST'
      sessionId: string
      devices: Array<{
        id: string
        deviceName: string
        username: string
        role: string
        connectedAt: number
      }>
    }
  | { type: 'KICKED'; sessionId: string; reason: string }
  // Session sharing
  | { type: 'SESSION_SHARED'; sessionId: string; sharedBy: string; permission: string }
  | { type: 'SESSION_UNSHARED'; sessionId: string }
  | { type: 'WRITE_REQUESTED'; sessionId: string; username: string }
  | { type: 'WRITE_GRANTED'; sessionId: string }
  | {
      type: 'SHARED_SESSIONS_LIST'
      sessions: Array<{
        sessionId: string
        ownerName: string
        tmuxSessionName: string
        permission: string
        adapterName: string
      }>
    }

// 终端尺寸范围常量（SessionManager 和 WSGateway 共用）
export const TERM_COLS_MIN = 1
export const TERM_COLS_MAX = 500
export const TERM_ROWS_MIN = 1
export const TERM_ROWS_MAX = 200

// JWT Token 对
export interface TokenPair {
  accessToken: string
  refreshToken: string
}

// JWT Payload
export interface JwtPayload {
  userId: string
  username: string
  role: string
  tokenVersion: number
  iat: number
  exp: number
}
