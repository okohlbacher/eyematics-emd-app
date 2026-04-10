import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { readBody } from '../server/utils.js';

/**
 * Create a mock IncomingMessage-like readable stream from a string body.
 * The stream emits the body as data chunks, then ends.
 */
function mockRequest(body: string): import('http').IncomingMessage {
  const stream = new Readable({
    read() {
      this.push(Buffer.from(body));
      this.push(null);
    },
  });
  // Add minimal IncomingMessage properties
  return stream as unknown as import('http').IncomingMessage;
}

describe('Audit body capture (AUDIT-01, AUDIT-09)', () => {
  it('attaches _capturedBody to request after readBody()', async () => {
    const req = mockRequest('{"key":"value"}');
    await readBody(req);
    // _capturedBody is augmented on Express Request; cast to access
    expect((req as unknown as Record<string, unknown>)._capturedBody).toBe('{"key":"value"}');
  });

  it('returns the body string as resolve value (unchanged behavior)', async () => {
    const req = mockRequest('hello world');
    const result = await readBody(req);
    expect(result).toBe('hello world');
  });

  it('attaches YAML body string as _capturedBody', async () => {
    const yamlBody = 'therapyInterrupterDays: 120\ntherapyBreakerDays: 365';
    const req = mockRequest(yamlBody);
    await readBody(req);
    expect((req as unknown as Record<string, unknown>)._capturedBody).toBe(yamlBody);
  });

  it('attaches empty string as _capturedBody for empty body', async () => {
    const req = mockRequest('');
    await readBody(req);
    expect((req as unknown as Record<string, unknown>)._capturedBody).toBe('');
  });
});
