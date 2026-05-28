import { describe, it, expect, beforeEach } from 'vitest'
import { SessionRecorder } from '../core/recorder.js'

describe('SessionRecorder', () => {
  let recorder: SessionRecorder

  beforeEach(() => {
    recorder = new SessionRecorder()
  })

  describe('basic lifecycle', () => {
    it('should start in non-recording state', () => {
      expect(recorder.isRecording()).toBe(false)
    })

    it('should be recording after start()', () => {
      recorder.start()
      expect(recorder.isRecording()).toBe(true)
    })

    it('should stop recording after stop()', () => {
      recorder.start()
      recorder.stop()
      expect(recorder.isRecording()).toBe(false)
    })

    it('should reset on start()', () => {
      recorder.start()
      recorder.record(Buffer.from('hello'), Date.now())
      recorder.start() // restart
      expect(recorder.getPlayback()).toHaveLength(0)
    })
  })

  describe('record()', () => {
    it('should not record when not started', () => {
      recorder.record(Buffer.from('hello'), Date.now())
      expect(recorder.getPlayback()).toHaveLength(0)
    })

    it('should record chunks when started', () => {
      recorder.start()
      const now = Date.now()
      recorder.record(Buffer.from('hello'), now)
      recorder.record(Buffer.from('world'), now + 100)
      expect(recorder.getPlayback()).toHaveLength(2)
    })
  })

  describe('getPlayback()', () => {
    it('should return empty array when no data', () => {
      expect(recorder.getPlayback()).toEqual([])
    })

    it('should filter by startTime', () => {
      recorder.start()
      const now = Date.now()
      recorder.record(Buffer.from('a'), now)
      recorder.record(Buffer.from('b'), now + 1000)
      recorder.record(Buffer.from('c'), now + 2000)

      const result = recorder.getPlayback(now + 500)
      expect(result).toHaveLength(2)
      expect(result[0].data.toString()).toBe('b')
    })

    it('should filter by endTime', () => {
      recorder.start()
      const now = Date.now()
      recorder.record(Buffer.from('a'), now)
      recorder.record(Buffer.from('b'), now + 1000)
      recorder.record(Buffer.from('c'), now + 2000)

      const result = recorder.getPlayback(undefined, now + 1500)
      expect(result).toHaveLength(2)
      expect(result[1].data.toString()).toBe('b')
    })

    it('should filter by both startTime and endTime', () => {
      recorder.start()
      const now = Date.now()
      recorder.record(Buffer.from('a'), now)
      recorder.record(Buffer.from('b'), now + 1000)
      recorder.record(Buffer.from('c'), now + 2000)

      const result = recorder.getPlayback(now + 500, now + 1500)
      expect(result).toHaveLength(1)
      expect(result[0].data.toString()).toBe('b')
    })
  })

  describe('getDuration()', () => {
    it('should return 0 when empty', () => {
      expect(recorder.getDuration()).toBe(0)
    })

    it('should calculate duration from first to last chunk', () => {
      recorder.start()
      const now = Date.now()
      recorder.record(Buffer.from('a'), now)
      recorder.record(Buffer.from('b'), now + 5000)
      expect(recorder.getDuration()).toBe(5000)
    })
  })

  describe('clear()', () => {
    it('should reset everything', () => {
      recorder.start()
      recorder.record(Buffer.from('hello'), Date.now())
      recorder.clear()
      expect(recorder.isRecording()).toBe(false)
      expect(recorder.getPlayback()).toHaveLength(0)
      expect(recorder.getDuration()).toBe(0)
      expect(recorder.getStartTime()).toBeNull()
    })
  })

  describe('auto-trim', () => {
    it('should trim old data beyond maxDurationMs', () => {
      const maxDuration = 1000 // 1 second
      const recorder = new SessionRecorder(maxDuration)
      recorder.start()

      const now = Date.now()
      // Old data (beyond 1s cutoff)
      recorder.record(Buffer.from('old'), now - 2000)
      // Recent data
      recorder.record(Buffer.from('new'), now)

      // Auto-trim happens during record(), but only via head pointer
      // getPlayback() should skip old entries
      const playback = recorder.getPlayback()
      // The old entry is still in the array but head should have advanced
      expect(playback.every(c => c.timestamp >= now - maxDuration)).toBe(true)
    })
  })

  describe('getStartTime()', () => {
    it('should return null before start', () => {
      expect(recorder.getStartTime()).toBeNull()
    })

    it('should return timestamp after start', () => {
      const before = Date.now()
      recorder.start()
      const after = Date.now()
      const startTime = recorder.getStartTime()
      expect(startTime).toBeGreaterThanOrEqual(before)
      expect(startTime).toBeLessThanOrEqual(after)
    })
  })

  describe('max chunks limit', () => {
    it('should prevent unbounded memory growth by trimming old chunks', () => {
      const recorder = new SessionRecorder(30 * 60 * 1000)
      recorder.start()
      const now = Date.now()

      // Simulate excessive recording (well over 100k chunks)
      for (let i = 0; i < 100_200; i++) {
        recorder.record(Buffer.from(`chunk-${i}`), now + i)
      }

      // After trimming, playback should still work and not contain all chunks
      const playback = recorder.getPlayback()
      expect(playback.length).toBeGreaterThan(0)
      // The total should be less than what we pushed (trimming kicked in)
      expect(playback.length).toBeLessThan(100_200)
    })
  })
})
