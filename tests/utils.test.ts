/**
 * T-09: Tests for server/utils.ts — readBody, validateAuth, sendError.
 */

import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { readBody, sendError, validateAuth } from '../server/utils';

// ---------------------------------------------------------------------------
// readBody
// ---------------------------------------------------------------------------

describe('readBody', () => {
  function mockStream(chunks: string[]): IncomingMessage {
    const emitter = new EventEmitter();
    (emitter as unknown as Record<string, unknown>).destroy = vi.fn();
    setTimeout(() => {
      for (const chunk of chunks) {
        emitter.emit('data', Buffer.from(chunk));
      }
      emitter.emit('end');
    }, 0);
    return emitter as unknown as IncomingMessage;
  }

  it('reads a complete body', async () => {
    const req = mockStream(['hello', ' world']);
    const body = await readBody(req);
    expect(body).toBe('hello world');
  });

  it('sets _capturedBody on the request', async () => {
    const req = mockStream(['test']);
    await readBody(req);
    expect((req as unknown as Record<string, unknown>)._capturedBody).toBe('test');
  });

  it('rejects when body exceeds maxSize', async () => {
    const req = mockStream(['x'.repeat(100)]);
    await expect(readBody(req, 50)).rejects.toThrow('too large');
  });

  it('handles empty body', async () => {
    const req = mockStream([]);
    const body = await readBody(req);
    expect(body).toBe('');
  });

  it('rejects on stream error', async () => {
    const emitter = new EventEmitter();
    setTimeout(() => emitter.emit('error', new Error('stream failed')), 0);
    await expect(readBody(emitter as unknown as IncomingMessage)).rejects.toThrow('stream failed');
  });
});

// ---------------------------------------------------------------------------
// validateAuth
// ---------------------------------------------------------------------------

describe('validateAuth', () => {
  function mockReq(authHeader?: string): IncomingMessage {
    return { headers: { authorization: authHeader } } as unknown as IncomingMessage;
  }

  function encodeToken(payload: Record<string, unknown>): string {
    return `Bearer ${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  it('returns null without Authorization header', () => {
    expect(validateAuth(mockReq())).toBeNull();
  });

  it('returns null with non-Bearer header', () => {
    expect(validateAuth(mockReq('Basic abc'))).toBeNull();
  });

  it('returns null with invalid base64', () => {
    expect(validateAuth(mockReq('Bearer !!!invalid!!!'))).toBeNull();
  });

  it('returns null for unknown username', () => {
    expect(validateAuth(mockReq(encodeToken({ username: 'hacker', role: 'admin' })))).toBeNull();
  });

  it('returns null when claimed role mismatches actual role', () => {
    // forscher1 is a researcher, not admin
    expect(validateAuth(mockReq(encodeToken({ username: 'forscher1', role: 'admin' })))).toBeNull();
  });

  it('returns user for valid known user with correct role', () => {
    const result = validateAuth(mockReq(encodeToken({ username: 'admin', role: 'admin' })));
    expect(result).toEqual({ username: 'admin', role: 'admin' });
  });

  it('validates researcher role', () => {
    const result = validateAuth(mockReq(encodeToken({ username: 'forscher1', role: 'researcher' })));
    expect(result).toEqual({ username: 'forscher1', role: 'researcher' });
  });

  it('returns null when requiredRole does not match', () => {
    const result = validateAuth(
      mockReq(encodeToken({ username: 'forscher1', role: 'researcher' })),
      'admin',
    );
    expect(result).toBeNull();
  });

  it('returns user when requiredRole matches', () => {
    const result = validateAuth(
      mockReq(encodeToken({ username: 'admin', role: 'admin' })),
      'admin',
    );
    expect(result).toEqual({ username: 'admin', role: 'admin' });
  });

  it('is case-insensitive for username lookup', () => {
    const result = validateAuth(mockReq(encodeToken({ username: 'Admin', role: 'admin' })));
    expect(result).toEqual({ username: 'Admin', role: 'admin' });
  });
});

// ---------------------------------------------------------------------------
// sendError
// ---------------------------------------------------------------------------

describe('sendError', () => {
  it('sends JSON error response with status code', () => {
    const written: Buffer[] = [];
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => written.push(Buffer.from(data))),
    } as unknown as ServerResponse;

    sendError(res, 403, 'Forbidden');

    expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
    const body = JSON.parse(written[0].toString());
    expect(body.error).toBe('Forbidden');
  });

  it('logs internal error to console but does not expose it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    sendError(res, 500, 'Internal error', new Error('secret detail'));

    expect(spy).toHaveBeenCalled();
    const body = JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(body.error).toBe('Internal error');
    expect(body.error).not.toContain('secret detail');
    spy.mockRestore();
  });
});
