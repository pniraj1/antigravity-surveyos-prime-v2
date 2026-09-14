import { describe, expect, it } from 'vitest';
import { geminiAuthHeaders } from '../service';

describe('geminiAuthHeaders', () => {
  it('sends AI Studio keys (new AQ. and legacy AIza) as x-goog-api-key', () => {
    expect(geminiAuthHeaders('AQ.Ab_new_key')).toEqual({ 'x-goog-api-key': 'AQ.Ab_new_key' });
    expect(geminiAuthHeaders('AIzaSyOld')).toEqual({ 'x-goog-api-key': 'AIzaSyOld' });
  });
  it('sends OAuth access tokens as Bearer', () => {
    expect(geminiAuthHeaders('ya29.token')).toEqual({ Authorization: 'Bearer ya29.token' });
  });
});
