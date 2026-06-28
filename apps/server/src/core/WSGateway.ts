import { WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import {
  JwtPayload,
  TERM_PING,
  TERM_PONG,
  TERM_SERVER_PING,
  TERM_COLS_MIN,
  TERM_COLS_MAX,
  TERM_ROWS_MIN,
  TERM_ROWS_MAX,
  ControlClientMessage,
} from '@ai-cli/shared'
import { SessionManager } from './SessionManager.js'
// [M-#13修复] getUser 改为静态导入（模块启动时已加载）
import { getTokenVersion, getUser } from '../plugins/auth.js'
import { pinoLogger } from '../lib/logger.js'
import { getConfig } from '../lib/config.js'
import path from 'path'

const PING_INTERVAL_MS = 30000
// [M-#7修复] GET_RECORDING 返回数据最大条数限制
const MAX_RECORDING_CHUNKS = 10000

/**
 * WSGateway — WebSocket connection handler for terminal and control channels.
 *
 * Manages authentication (JWT), terminal data forwarding,
 * control message dispatch, and keep-alive probes.
 */
export class WSGateway {
  private sessionManager: SessionManager
  private jwtSecret: string
  private jwtRefreshSecret: string

  private pingTimers = new Map<WebSocket, NodeJS.Timeout>()
  private controlClients = new Set<WebSocket>()
  private termDeviceMap = new Map<WebSocket, { sessionId: string; deviceId: string }>()
  private ctrlDeviceMap = new Map<WebSocket, { sessionId: string; deviceId: string }>()
  private ctrlUserMap = new Map<WebSocket, string>()

  constructor(sessionManager: SessionManager, jwtSecret: string, jwtRefreshSecret: string) {
    this.sessionManager = sessionManager
    this.jwtSecret = jwtSecret
    this.jwtRefreshSecret = jwtRefreshSecret
  }

  // ========== Terminal Channel ==========

  /**
   * Handle a new terminal WebSocket connection.
   * Auth is already verified at the HTTP upgrade level (query-param token).
   * Accepts ATTACH_SESSION then switches to binary mode.
   *
   * @param ws - The incoming WebSocket connection
   * @param user - The authenticated user (verified via query-param JWT)
   */
  handleTerminalConnection(ws: WebSocket, user: JwtPayload): void {
    let sessionId: string | null = null
    const deviceId: string | null = null

    pinoLogger.info({ userId: user.userId }, 'Terminal WS connected (pre-authenticated)')

    ws.on('message', (data: Buffer) => {
      // No session attached yet — accept ATTACH_SESSION
      if (sessionId === null) {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ATTACH_SESSION' && msg.sessionId) {
            if (!this.sessionManager.hasSession(msg.sessionId)) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
              return
            }
            // Admin can attach to any session; other users must be owner
            const owner = this.sessionManager.getOwner(msg.sessionId)
            if (owner && owner !== user.userId && user.role !== 'admin') {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
              return
            }
            sessionId = msg.sessionId
            pinoLogger.info({ sessionId }, 'Terminal WS attached to session')
            this.sessionManager.attachClient(sessionId!, ws, undefined)
            // 不恢复 tmux 历史：纯文本无 ANSI 颜色码导致颜色错误+光标偏移
            // 用户可在 tmux 内通过 PageUp/滑动 查看完整历史
          }
        } catch {
          // binary data before ATTACH, discard
        }
        return
      }

      // Binary mode: PING (0x00) or keyboard input
      if (data.length === 1 && data[0] === TERM_PING) {
        ws.send(Buffer.from([TERM_PONG]))
        return
      }

      // Block input from observers (non-controller devices)
      if (deviceId && !this.sessionManager.isDeviceController(sessionId!, ws)) {
        return
      }

      // Forward keyboard input to pty
      this.sessionManager.sendInput(sessionId!, data)
    })

    ws.on('close', () => {
      this.cleanupPing(ws)
      const entry = this.termDeviceMap.get(ws)
      if (sessionId && entry) {
        this.sessionManager.unregisterDevice(sessionId, entry.deviceId)
      }
      this.termDeviceMap.delete(ws)
      pinoLogger.info({ sessionId }, 'Terminal WS disconnected')
      if (sessionId) {
        this.sessionManager.detachClient(sessionId, ws, undefined)
      }
    })

    this.setupTerminalKeepAlive(ws)
  }

  // ========== Control Channel ==========

  /**
   * Handle a new control WebSocket connection.
   * Auth is already verified at the HTTP upgrade level (query-param token).
   * Dispatches JSON control messages immediately.
   *
   * @param ws - The incoming WebSocket connection
   * @param user - The authenticated user (verified via query-param JWT)
   */
  handleControlConnection(ws: WebSocket, user: JwtPayload): void {
    let currentSessionId: string | null = null

    this.controlClients.add(ws)
    this.ctrlUserMap.set(ws, user.userId)
    pinoLogger.info({ username: user.username }, 'Control WS connected (pre-authenticated)')

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString())
        void this.handleControlMessage(ws, msg, currentSessionId, user, (sid) => {
          currentSessionId = sid
        }).catch((err) => {
          pinoLogger.warn({ err }, 'handleControlMessage error')
          try {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Internal error' }))
          } catch {
            /* ws may be closed */
          }
        })
      } catch {
        // invalid JSON
      }
    })

    ws.on('close', () => {
      this.controlClients.delete(ws)
      this.ctrlUserMap.delete(ws)
      this.cleanupPing(ws)
      const entry = this.ctrlDeviceMap.get(ws)
      if (entry) {
        this.sessionManager.unregisterDevice(entry.sessionId, entry.deviceId)
      }
      this.ctrlDeviceMap.delete(ws)
      pinoLogger.info({ sessionId: currentSessionId }, 'Control WS disconnected')
      if (currentSessionId) {
        this.sessionManager.detachClient(currentSessionId, undefined, ws)
        this.sessionManager.detachObserver(currentSessionId, ws)
      }
    })

    this.setupControlKeepAlive(ws)
  }

  // ========== Session Access Validation ==========

  // [Q3修复] 提取公共的 session 校验逻辑
  private validateSessionAccess(
    ws: WebSocket,
    sessionId: string,
    currentUser: JwtPayload | null,
  ): boolean {
    if (ws.readyState !== WebSocket.OPEN) return false
    if (!this.sessionManager.hasSession(sessionId)) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
      return false
    }
    if (!currentUser) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
      return false
    }
    // Admin users can access all sessions
    if (currentUser.role === 'admin') return true
    const owner = this.sessionManager.getOwner(sessionId)
    if (owner === currentUser.userId) return true
    // Check shared permissions
    const perm = this.sessionManager.getSessionPermission(sessionId, currentUser.userId)
    if (perm) return true
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
    return false
  }

  // ========== Control Message Dispatch ==========

  private async handleControlMessage(
    ws: WebSocket,
    msg: ControlClientMessage,
    currentSessionId: string | null,
    currentUser: JwtPayload | null,
    setSessionId: (sid: string) => void,
  ): Promise<void> {
    // [C3修复] 终端尺寸范围限制（使用 shared 常量）

    switch (msg.type) {
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG' }))
        break

      case 'REFRESH': {
        try {
          const decoded = jwt.verify(msg.refreshToken, this.jwtRefreshSecret) as JwtPayload
          const currentVersion = getTokenVersion(decoded.username)
          if (currentVersion !== -1 && decoded.tokenVersion !== currentVersion) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Token revoked' }))
            break
          }
          const newAccessToken = jwt.sign(
            {
              userId: decoded.userId,
              username: decoded.username,
              role: decoded.role,
              tokenVersion: decoded.tokenVersion,
            },
            this.jwtSecret,
            { expiresIn: '15m' },
          )
          ws.send(JSON.stringify({ type: 'TOKEN_RENEWED', accessToken: newAccessToken }))
        } catch {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid refresh token' }))
        }
        break
      }

      case 'INIT_SESSION': {
        const { sessionId, cols, rows, adapter } = msg
        const attachToTmux = (msg as { attachToTmux?: string }).attachToTmux
        const cwd = (msg as { cwd?: string }).cwd
        const safeCols = Math.max(TERM_COLS_MIN, Math.min(TERM_COLS_MAX, Math.floor(cols) || 80))
        const safeRows = Math.max(TERM_ROWS_MIN, Math.min(TERM_ROWS_MAX, Math.floor(rows) || 24))
        try {
          if (!currentUser) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
            break
          }
          this.sessionManager.createOrAttachSession(
            sessionId,
            safeCols,
            safeRows,
            adapter,
            currentUser.userId,
            attachToTmux,
            cwd,
          )
          this.sessionManager.attachClient(sessionId, undefined, ws)
          // Register device and notify observer mode
          const termInfo = this.findTermWsForSession(sessionId, ws)
          if (termInfo) {
            const { deviceId, isObserver } = this.sessionManager.registerDevice(
              sessionId,
              termInfo,
              ws,
              currentUser.username,
              'Device',
            )
            this.termDeviceMap.set(termInfo, { sessionId, deviceId })
            this.ctrlDeviceMap.set(ws, { sessionId, deviceId })
            if (isObserver) {
              ws.send(JSON.stringify({ type: 'OBSERVER_MODE', sessionId, isObserver: true }))
            }
          }
          setSessionId(sessionId)
          ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId }))
          this.broadcastDeviceList(sessionId)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'ATTACH_SESSION': {
        const { sessionId } = msg
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) return
        try {
          this.sessionManager.attachClient(sessionId, undefined, ws)
          setSessionId(sessionId)
          this.broadcastDeviceList(sessionId)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'RESIZE': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        // [R8修复] RESIZE 也需要校验会话归属
        if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        if (msg.cols && msg.rows) {
          // [C3修复] 校验终端尺寸参数范围
          const safeCols = Math.max(
            TERM_COLS_MIN,
            Math.min(TERM_COLS_MAX, Math.floor(msg.cols) || 80),
          )
          const safeRows = Math.max(
            TERM_ROWS_MIN,
            Math.min(TERM_ROWS_MAX, Math.floor(msg.rows) || 24),
          )
          // Skip resize when multiple terminal clients are attached (prevents multi-device conflict)
          if (!this.sessionManager.shouldResize(currentSessionId)) break
          try {
            this.sessionManager.resize(currentSessionId, safeCols, safeRows)
          } catch (err) {
            // session may have been destroyed
            pinoLogger.warn(
              { err, sessionId: currentSessionId },
              'RESIZE failed — session may have been destroyed',
            )
          }
        }
        break
      }

      case 'QUICK_ACTION': {
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser))
          break
        if (msg.payload) {
          this.sessionManager.sendQuickAction(currentSessionId, msg.payload)
        }
        break
      }

      case 'INJECT_CODE': {
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser))
          break
        // [Q2修复] 服务端 INJECT_CODE 大小兜底校验（1MB）
        const INJECT_CODE_MAX_SIZE = 1048576
        if (msg.code && Buffer.byteLength(msg.code, 'utf-8') > INJECT_CODE_MAX_SIZE) {
          ws.send(
            JSON.stringify({ type: 'ERROR', message: 'INJECT_CODE exceeds maximum size (1MB)' }),
          )
          break
        }
        if (msg.code) {
          this.sessionManager.sendInput(currentSessionId, msg.code)
        }
        break
      }

      case 'OBSERVE_SESSION': {
        const { sessionId } = msg
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) return
        try {
          this.sessionManager.attachObserver(sessionId, ws)
          setSessionId(sessionId)
          ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'START_RECORDING': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        try {
          this.sessionManager.startRecording(currentSessionId)
          const status = this.sessionManager.getRecordingStatus(currentSessionId)
          ws.send(
            JSON.stringify({ type: 'RECORDING_STATUS', sessionId: currentSessionId, ...status }),
          )
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'STOP_RECORDING': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        try {
          this.sessionManager.stopRecording(currentSessionId)
          const status = this.sessionManager.getRecordingStatus(currentSessionId)
          ws.send(
            JSON.stringify({ type: 'RECORDING_STATUS', sessionId: currentSessionId, ...status }),
          )
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'GET_RECORDING': {
        const { sessionId, startTime, endTime } = msg
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) break
        try {
          let chunks = this.sessionManager.getRecording(sessionId, startTime, endTime)
          // [M-#7修复] 超过 MAX_RECORDING_CHUNKS 时截断最后 N 条并发送 WARNING
          let truncated = false
          if (chunks.length > MAX_RECORDING_CHUNKS) {
            chunks = chunks.slice(-MAX_RECORDING_CHUNKS)
            truncated = true
          }
          // [M10修复] 使用 base64 替代 Array.from 避免内存膨胀
          const data = chunks.map((c) => ({
            data: c.data.toString('base64'),
            timestamp: c.timestamp,
          }))
          ws.send(JSON.stringify({ type: 'RECORDING_DATA', sessionId, data }))
          if (truncated) {
            ws.send(
              JSON.stringify({
                type: 'WARNING',
                message: `Recording truncated to last ${MAX_RECORDING_CHUNKS} chunks`,
              }),
            )
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'LIST_PANES': {
        if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser))
          break
        try {
          const panes = await this.sessionManager.getPanes(currentSessionId)
          ws.send(JSON.stringify({ type: 'PANE_INFO', sessionId: currentSessionId, panes }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to list panes'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'SELECT_PANE': {
        if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser))
          break
        try {
          await this.sessionManager.selectPane(currentSessionId, msg.paneIndex)
          const panes = await this.sessionManager.getPanes(currentSessionId)
          ws.send(JSON.stringify({ type: 'PANE_INFO', sessionId: currentSessionId, panes }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to select pane'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      // ========== Multi-device control ==========

      case 'REQUEST_CONTROL': {
        const { sessionId } = msg
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) break
        this.sessionManager.requestControl(sessionId, ws, currentUser?.username || 'Unknown')
        break
      }

      case 'GRANT_CONTROL': {
        const { sessionId, requestId } = msg
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) break
        const granted = this.sessionManager.grantControl(sessionId, requestId, ws)
        if (!granted) {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              message: 'Only the current controller can grant control',
            }),
          )
          break
        }
        this.broadcastDeviceList(sessionId)
        break
      }

      case 'DENY_CONTROL': {
        // Request denied — no state change needed
        break
      }

      case 'FORCE_TAKE_CONTROL': {
        const { sessionId } = msg as { type: string; sessionId: string }
        if (!currentUser || currentUser.role !== 'admin') {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Admin required' }))
          break
        }
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) break
        this.sessionManager.forceTakeControl(sessionId, ws, true)
        this.broadcastDeviceList(sessionId)
        break
      }

      // ========== Session Sharing ==========

      case 'SHARE_SESSION': {
        const { sessionId, targetUsername, permission } = msg as {
          type: string
          sessionId: string
          targetUsername: string
          permission: string
        }
        if (!currentUser) break
        const targetUser = getUser(targetUsername)
        if (!targetUser) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Target user not found' }))
          break
        }
        const ok = this.sessionManager.shareSession(
          sessionId,
          currentUser.userId,
          targetUser.userId,
          permission as 'read' | 'write',
        )
        if (!ok) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Not session owner' }))
          break
        }
        ws.send(
          JSON.stringify({
            type: 'SESSION_SHARED',
            sessionId,
            sharedBy: currentUser.username,
            permission,
          }),
        )
        break
      }

      case 'UNSHARE_SESSION': {
        const { sessionId, targetUsername } = msg as {
          type: string
          sessionId: string
          targetUsername: string
        }
        if (!currentUser) break
        const targetUser = getUser(targetUsername)
        if (!targetUser) break
        this.sessionManager.unshareSession(sessionId, currentUser.userId, targetUser.userId)
        ws.send(JSON.stringify({ type: 'SESSION_UNSHARED', sessionId }))
        break
      }

      case 'REQUEST_WRITE': {
        const { sessionId } = msg
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) break
        // Notify session owner's control channel
        const session = this.sessionManager.getSession(sessionId)
        if (session) {
          for (const dev of session.devices.values()) {
            if (dev.role === 'controller' && dev.ctrlWs?.readyState === 1) {
              dev.ctrlWs.send(
                JSON.stringify({
                  type: 'WRITE_REQUESTED',
                  sessionId,
                  username: currentUser?.username || 'Unknown',
                }),
              )
            }
          }
        }
        break
      }
    }
  }

  // ========== Device Helpers ==========

  private findTermWsForSession(sessionId: string, _ctrlWs: WebSocket): WebSocket | null {
    // Find the most recently attached term WS for this session
    // This is a best-effort match — the term WS and ctrl WS arrive nearly simultaneously
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return null
    for (const ws of session.termClients) {
      if (!this.termDeviceMap.has(ws)) return ws
    }
    return null
  }

  private broadcastDeviceList(sessionId: string): void {
    const devices = this.sessionManager.getConnectedDevices(sessionId)
    const msg = JSON.stringify({ type: 'DEVICE_LIST', sessionId, devices })
    const session = this.sessionManager.getSession(sessionId)
    if (!session) return
    for (const dev of session.devices.values()) {
      if (dev.ctrlWs?.readyState === 1) {
        dev.ctrlWs.send(msg)
      }
    }
  }

  // ========== Keep-Alive ==========

  private setupTerminalKeepAlive(ws: WebSocket): void {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send SERVER_PING (0x02) as server-side keep-alive probe
        ws.send(Buffer.from([TERM_SERVER_PING]))
      }
    }, PING_INTERVAL_MS)
    this.pingTimers.set(ws, timer)
  }

  private setupControlKeepAlive(ws: WebSocket): void {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }))
      }
    }, PING_INTERVAL_MS)
    this.pingTimers.set(ws, timer)
  }

  private cleanupPing(ws: WebSocket): void {
    const timer = this.pingTimers.get(ws)
    if (timer) {
      clearInterval(timer)
      this.pingTimers.delete(ws)
    }
  }

  /**
   * Destroy the gateway: close all WebSocket connections and clear keep-alive timers.
   * Call on server shutdown.
   */
  destroy(): void {
    for (const timer of this.pingTimers.values()) {
      clearInterval(timer)
    }
    this.pingTimers.clear()
    // [M-#15修复] 在清 map 前遍历所有 WS 调用 .close()，确保连接被正确关闭
    for (const ws of this.controlClients) {
      try {
        ws.close()
      } catch {
        /* ws may already be closed */
      }
    }
    for (const ws of this.termDeviceMap.keys()) {
      try {
        ws.close()
      } catch {
        /* ws may already be closed */
      }
    }
    this.controlClients.clear()
    this.ctrlDeviceMap.clear()
    this.ctrlUserMap.clear()
  }

  broadcastFileChange(event: { path: string; oldContent: string; newContent: string }): void {
    // [M-#2修复] 只向 PROJECT_ROOT 匹配的会话用户广播文件变更
    const projectRoot = getConfig().PROJECT_ROOT
    const fullPath = path.join(projectRoot, event.path)
    if (!fullPath.startsWith(projectRoot)) return
    const msg = JSON.stringify({ type: 'FILE_CHANGED', ...event })
    for (const [ws, userId] of this.ctrlUserMap) {
      if (ws.readyState !== ws.OPEN) continue
      // Only send to users who own or have access to sessions in the same PROJECT_ROOT
      const hasRelevantSession = this.sessionManager.getSessionIds().some((sid) => {
        const owner = this.sessionManager.getOwner(sid)
        if (owner === userId) return true
        return this.sessionManager.getSessionPermission(sid, userId) !== null
      })
      if (hasRelevantSession) {
        ws.send(msg)
      }
    }
  }
}
