import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useColumnResize, clampColumnWidth } from '../useColumnResize';

describe('useColumnResize logic & clampColumnWidth', () => {
  it('clamps width correctly within bounds', () => {
    expect(clampColumnWidth(100, 180, 750)).toBe(180);
    expect(clampColumnWidth(900, 180, 750)).toBe(750);
    expect(clampColumnWidth(400, 180, 750)).toBe(400);
  });

  it('renders with default width during SSR/static markup', () => {
    let capturedWidth = 0;
    function TestComponent() {
      const { width } = useColumnResize({ storageKey: 'test_key', defaultWidth: 380 });
      capturedWidth = width;
      return React.createElement('div', null, String(width));
    }
    const html = renderToStaticMarkup(React.createElement(TestComponent));
    expect(html).toContain('380');
    expect(capturedWidth).toBe(380);
  });
});
