'use client';
import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  x: number; y: number; translateX: number; translateY: number;
  size: number; alpha: number; targetAlpha: number;
  dx: number; dy: number; magnetism: number;
}

interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  color?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function Particles({
  className,
  quantity = 80,
  staticity = 50,
  ease = 50,
  size = 0.5,
  color = '#F59E0B',
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const circlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const dpr = useRef(1);
  const raf = useRef(0);
  const rgb = hexToRgb(color);

  const resize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!container || !canvas || !ctx) return;
    circlesRef.current = [];
    dpr.current = window.devicePixelRatio || 1;
    sizeRef.current = { w: container.offsetWidth, h: container.offsetHeight };
    canvas.width = sizeRef.current.w * dpr.current;
    canvas.height = sizeRef.current.h * dpr.current;
    canvas.style.width = `${sizeRef.current.w}px`;
    canvas.style.height = `${sizeRef.current.h}px`;
    ctx.scale(dpr.current, dpr.current);
  }, []);

  const makeParticle = useCallback((): Particle => ({
    x: Math.random() * sizeRef.current.w,
    y: Math.random() * sizeRef.current.h,
    translateX: 0, translateY: 0,
    size: Math.random() * 1.5 + size,
    alpha: 0,
    targetAlpha: parseFloat((Math.random() * 0.5 + 0.1).toFixed(1)),
    dx: (Math.random() - 0.5) * 0.08,
    dy: (Math.random() - 0.5) * 0.08,
    magnetism: 0.1 + Math.random() * 3,
  }), [size]);

  const drawParticle = useCallback((p: Particle, update = false) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.translate(p.translateX, p.translateY);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${p.alpha})`;
    ctx.fill();
    ctx.restore();
    if (!update) circlesRef.current.push(p);
  }, [rgb]);

  const animate = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    circlesRef.current.forEach((p, i) => {
      const edges = [
        p.x + p.translateX - p.size,
        w - p.x - p.translateX - p.size,
        p.y + p.translateY - p.size,
        h - p.y - p.translateY - p.size,
      ];
      const closest = Math.min(...edges);
      p.alpha = closest > 20
        ? Math.min(p.alpha + 0.02, p.targetAlpha)
        : p.targetAlpha * Math.max(0, Math.min(1, closest / 20));

      p.x += p.dx + mouseRef.current.x / (staticity / p.magnetism);
      p.y += p.dy + mouseRef.current.y / (staticity / p.magnetism);
      p.translateX += (mouseRef.current.x / (staticity / p.magnetism) - p.translateX) / ease;
      p.translateY += (mouseRef.current.y / (staticity / p.magnetism) - p.translateY) / ease;

      drawParticle(p, true);

      if (p.x < -p.size || p.x > w + p.size || p.y < -p.size || p.y > h + p.size) {
        circlesRef.current.splice(i, 1);
        drawParticle(makeParticle());
      }
    });
    raf.current = requestAnimationFrame(animate);
  }, [drawParticle, makeParticle, staticity, ease]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext('2d');
    resize();
    for (let i = 0; i < quantity; i++) drawParticle(makeParticle());
    raf.current = requestAnimationFrame(animate);

    const onResize = () => { resize(); for (let i = 0; i < quantity; i++) drawParticle(makeParticle()); };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2,
      };
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [animate, drawParticle, makeParticle, quantity, resize]);

  return (
    <div ref={containerRef} className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
