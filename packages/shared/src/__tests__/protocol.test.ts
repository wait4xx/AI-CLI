import { describe, it, expect } from 'vitest'
import {
  TERM_PING,
  TERM_PONG,
  PROTOCOL_VERSION,
  WS_CLOSE_CODE,
  TERM_COLS_MIN,
  TERM_COLS_MAX,
  TERM_ROWS_MIN,
  TERM_ROWS_MAX,
} from '@ai-cli/shared'

describe('Shared Protocol Constants', () => {
  describe('Binary heartbeat', () => {
    it('TERM_PING should be 0x00', () => {
      expect(TERM_PING).toBe(0x00)
    })

    it('TERM_PONG should be 0x01', () => {
      expect(TERM_PONG).toBe(0x01)
    })

    it('TERM_PING and TERM_PONG should differ', () => {
      expect(TERM_PING).not.toBe(TERM_PONG)
    })
  })

  describe('Protocol version', () => {
    it('should be a non-empty semver string', () => {
      expect(PROTOCOL_VERSION).toBeTruthy()
      expect(PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('WS close codes', () => {
    it('AUTH_FAILED should be 4001', () => {
      expect(WS_CLOSE_CODE.AUTH_FAILED).toBe(4001)
    })

    it('PROTOCOL_MISMATCH should be 4002', () => {
      expect(WS_CLOSE_CODE.PROTOCOL_MISMATCH).toBe(4002)
    })

    it('close codes should be in valid range (>4000)', () => {
      expect(WS_CLOSE_CODE.AUTH_FAILED).toBeGreaterThan(4000)
      expect(WS_CLOSE_CODE.PROTOCOL_MISMATCH).toBeGreaterThan(4000)
    })
  })

  describe('Terminal dimension bounds', () => {
    it('MIN values should be >= 1', () => {
      expect(TERM_COLS_MIN).toBeGreaterThanOrEqual(1)
      expect(TERM_ROWS_MIN).toBeGreaterThanOrEqual(1)
    })

    it('MAX values should be greater than MIN', () => {
      expect(TERM_COLS_MAX).toBeGreaterThan(TERM_COLS_MIN)
      expect(TERM_ROWS_MAX).toBeGreaterThan(TERM_ROWS_MIN)
    })

    it('standard 80x24 should be within bounds', () => {
      expect(80).toBeGreaterThanOrEqual(TERM_COLS_MIN)
      expect(80).toBeLessThanOrEqual(TERM_COLS_MAX)
      expect(24).toBeGreaterThanOrEqual(TERM_ROWS_MIN)
      expect(24).toBeLessThanOrEqual(TERM_ROWS_MAX)
    })
  })
})
