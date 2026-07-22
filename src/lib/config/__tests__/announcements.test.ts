import { describe, it, expect } from 'vitest';
import { sanitizeLink, countUnread, type Announcement } from '../announcements';

const ann = (id: string, createdAt: number): Announcement => ({
  id, title: 't', body: 'b', type: 'general', createdAt, createdBy: 'admin',
});

describe('sanitizeLink', () => {
  it('allows http/https, blocks everything else', () => {
    expect(sanitizeLink('https://example.com/x')).toBe('https://example.com/x');
    expect(sanitizeLink('http://a.b')).toBe('http://a.b');
    expect(sanitizeLink('  https://trim.me  ')).toBe('https://trim.me');
    expect(sanitizeLink('javascript:alert(1)')).toBeNull();
    expect(sanitizeLink('data:text/html,x')).toBeNull();
    expect(sanitizeLink('/relative')).toBeNull();
    expect(sanitizeLink('')).toBeNull();
    expect(sanitizeLink(null)).toBeNull();
  });
});

describe('countUnread', () => {
  it('counts items newer than lastSeen', () => {
    const items = [ann('a', 300), ann('b', 200), ann('c', 100)];
    expect(countUnread(items, 150)).toBe(2);   // a, b
    expect(countUnread(items, undefined)).toBe(3);
    expect(countUnread(items, 300)).toBe(0);
    expect(countUnread([], 0)).toBe(0);
  });
});
