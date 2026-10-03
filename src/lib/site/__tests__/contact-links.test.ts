import { describe, it, expect } from 'vitest';
import { mapsDirectionsUrl, telHref } from '../contact-links';

describe('contact links', () => {
  it('builds an encoded Google Maps directions URL', () => {
    expect(mapsDirectionsUrl(' Sharma Motors, Hadapsar ')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Sharma%20Motors%2C%20Hadapsar',
    );
    expect(mapsDirectionsUrl('  ')).toBeNull();
  });

  it('builds tel: links from messy numbers', () => {
    expect(telHref('+91 98220-12345')).toBe('tel:+919822012345');
    expect(telHref('n/a')).toBeNull();
    expect(telHref('123')).toBeNull();
  });
});
