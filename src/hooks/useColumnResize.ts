'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ColumnResizeOptions {
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function clampColumnWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useColumnResize({
  storageKey,
  defaultWidth = 350,
  minWidth = 180,
  maxWidth = 750,
}: ColumnResizeOptions) {
  const [width, setWidth] = useState<number>(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(defaultWidth);
  const currentWidthRef = useRef(defaultWidth);

  // Hydration-safe initial load
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
            setWidth(parsed);
            startWidthRef.current = parsed;
            currentWidthRef.current = parsed;
          }
        }
      }
    } catch {}
  }, [storageKey, minWidth, maxWidth]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidthRef.current;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        const newWidth = clampColumnWidth(startWidthRef.current + delta, minWidth, maxWidth);
        currentWidthRef.current = newWidth;
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(storageKey, String(currentWidthRef.current));
          }
        } catch {}
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [storageKey, minWidth, maxWidth]
  );

  const onDoubleClick = useCallback(() => {
    setWidth(defaultWidth);
    currentWidthRef.current = defaultWidth;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(storageKey);
      }
    } catch {}
  }, [defaultWidth, storageKey]);

  return {
    width,
    isResizing,
    resizeHandleProps: {
      onMouseDown,
      onDoubleClick,
    },
    resetWidth: onDoubleClick,
  };
}
