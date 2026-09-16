import { describe, it, expect } from 'vitest';
import { classifyPing, parseContextWindow, parseImageCap } from '../probe-classify';

// Every body below is a verbatim response captured from NVIDIA NIM.

describe('parseContextWindow', () => {
  it('extracts the ceiling from a context-length rejection', () => {
    expect(parseContextWindow(
      '{"error":"This model\'s maximum context length is 16384 tokens. However, you ' +
      'requested 16448 tokens (64 in the messages, 16384 in the completion)."}'
    )).toBe(16384);
  });

  it('extracts the ceiling from the TRT-LLM shape of the same rejection', () => {
    expect(parseContextWindow(
      '{"error":{"message":"max_tokens=16384 cannot be greater than ' +
      'max_model_len=max_total_tokens=8192. Please request fewer output tokens."}}'
    )).toBe(8192);
  });

  it('returns null when the body says nothing about context', () => {
    expect(parseContextWindow('{"object":"error","message":"Bad request"}')).toBeNull();
    expect(parseContextWindow('')).toBeNull();
  });
});

describe('parseImageCap', () => {
  it('extracts the cap from a multi-image rejection', () => {
    expect(parseImageCap(
      '{"object":"error","message":"At most 1 image(s) may be provided in one request. ' +
      'You can set `--limit-mm-per-prompt` to increase this limit if the model supports it."}'
    )).toBe(1);
  });

  it('handles a cap above 1', () => {
    expect(parseImageCap('{"message":"At most 5 image(s) may be provided in one request."}')).toBe(5);
  });

  it('returns null when the body is about something else', () => {
    expect(parseImageCap('{"message":"Bad request"}')).toBeNull();
  });
});

describe('classifyPing', () => {
  it('accepts a 200', () => {
    const v = classifyPing({ status: 200, body: '{"choices":[{"message":{"content":"OK"}}]}' });
    expect(v.status).toBe('ok');
  });

  it('marks a 404 unreachable and keeps the provider detail as the reason', () => {
    const v = classifyPing({
      status: 404,
      body: '{"status":404,"title":"Not Found","detail":"Function \'ee47df99\': Not found for account \'6awCv\'"}',
    });
    expect(v.status).toBe('unreachable');
    expect(v.reason).toContain('Not found for account');
  });

  it('marks a text-input rejection', () => {
    const v = classifyPing({
      status: 400,
      body: '{"object":"error","message":"Content cannot be a plain string. The model does not support text input."}',
    });
    expect(v.status).toBe('no-text-input');
  });

  it('marks a model whose context cannot hold the extraction budget', () => {
    const v = classifyPing({
      status: 400,
      body: '{"error":"This model\'s maximum context length is 16384 tokens. However, you requested 16448 tokens."}',
    });
    expect(v.status).toBe('ctx-too-small');
    expect(v.ctxWindow).toBe(16384);
    expect(v.reason).toContain('16384');
  });

  it('catches the TRT-LLM context rejection as ctx-too-small, not a generic error', () => {
    const v = classifyPing({
      status: 400,
      body: '{"error":{"message":"max_tokens=16384 cannot be greater than max_model_len=max_total_tokens=8192."}}',
    });
    expect(v.status).toBe('ctx-too-small');
    expect(v.ctxWindow).toBe(8192);
  });

  it('marks 401 and 403 as an auth error, which aborts the provider', () => {
    expect(classifyPing({ status: 401, body: '{}' }).status).toBe('auth-error');
    expect(classifyPing({ status: 403, body: '{}' }).status).toBe('auth-error');
  });

  it('treats a 5xx as transient, not as a dead model', () => {
    expect(classifyPing({ status: 500, body: 'upstream exploded' }).status).toBe('transient');
    expect(classifyPing({ status: 503, body: '' }).status).toBe('transient');
  });

  it('treats a rate limit as transient', () => {
    expect(classifyPing({ status: 429, body: '{"message":"rate limit"}' }).status).toBe('transient');
  });

  it('marks 402 as a durable paid status', () => {
    const v = classifyPing({ status: 402, body: '{}' });
    expect(v.status).toBe('paid');
    expect(v.reason).toContain('credits');
  });

  it('treats our own timeout or transport failure as transient', () => {
    // A measured NVIDIA run read-timed out on 5 models that are demonstrably
    // alive, including meta/llama-3.2-1b-instruct. Cold start, not death.
    expect(classifyPing({ status: 0, body: 'ReadTimeout' }).status).toBe('transient');
  });

  it('falls back to a generic error for an unrecognised 4xx', () => {
    const v = classifyPing({ status: 422, body: 'nope' });
    expect(v.status).toBe('error');
    expect(v.reason).toContain('422');
  });

  it('never throws on an unparseable body', () => {
    expect(() => classifyPing({ status: 400, body: '<html>gateway timeout</html>' })).not.toThrow();
    expect(classifyPing({ status: 400, body: '<html>gateway timeout</html>' }).status).toBe('error');
  });
});
