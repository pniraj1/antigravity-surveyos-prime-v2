import { describe, it, expect } from 'vitest';
import { classifyGatewayError, gatewayErrorMessage } from '../gateway-errors';

/** Mimics a FirebaseError: a `code` string, no `status` property. */
function firebaseError(code: string, message = 'callable failed') {
  return Object.assign(new Error(message), { code });
}

describe('classifyGatewayError', () => {
  it('classifies a callable deadline as a timeout, not an auth failure', () => {
    expect(classifyGatewayError(firebaseError('functions/deadline-exceeded'))).toBe('timeout');
  });

  it('classifies a callable permission-denied as a subscription problem', () => {
    expect(classifyGatewayError(firebaseError('functions/permission-denied'))).toBe('subscription');
  });

  it('classifies a callable unauthenticated as a sign-in problem', () => {
    expect(classifyGatewayError(firebaseError('functions/unauthenticated'))).toBe('unauthenticated');
  });

  it('still classifies HTTP 401/403 as an auth (bad key) failure', () => {
    expect(classifyGatewayError(Object.assign(new Error('x'), { status: 401 }))).toBe('auth');
    expect(classifyGatewayError(Object.assign(new Error('x'), { status: 403 }))).toBe('auth');
  });

  it('does not treat an HTTP 500 as any of the special kinds', () => {
    expect(classifyGatewayError(Object.assign(new Error('x'), { status: 500 }))).toBe('other');
  });

  it('ignores a non-functions code string', () => {
    expect(classifyGatewayError(firebaseError('auth/user-not-found'))).toBe('other');
  });

  it('survives null and non-error input', () => {
    expect(classifyGatewayError(null)).toBe('other');
    expect(classifyGatewayError('boom')).toBe('other');
  });
});

describe('gatewayErrorMessage', () => {
  it('names the provider and suggests a faster model on timeout', () => {
    expect(gatewayErrorMessage('timeout', 'NVIDIA NIM'))
      .toBe('NVIDIA NIM timed out after 5 minutes — try a faster model in Profile → AI & Documents Intelligence.');
  });

  it('returns the subscription message', () => {
    expect(gatewayErrorMessage('subscription', 'NVIDIA NIM'))
      .toBe('Your SurveyOS subscription is not active. Please renew to use AI features.');
  });

  it('returns the sign-in message', () => {
    expect(gatewayErrorMessage('unauthenticated', 'NVIDIA NIM'))
      .toBe('Session expired — sign in again.');
  });

  it('returns null for kinds the caller already handles', () => {
    expect(gatewayErrorMessage('auth', 'NVIDIA NIM')).toBeNull();
    expect(gatewayErrorMessage('other', 'NVIDIA NIM')).toBeNull();
  });
});
