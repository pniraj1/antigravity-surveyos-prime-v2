'use client';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Star {
  x: number; y: number; angle: number; speed: number;
  size: number; alpha: number; trailLen: number;
}

interface ShootingStarsProps {
  className?: string;
  starColor?: string;
  quantity?: number;
  minDelay?: number;
  maxDelay?: number;
  minSpeed?: number;
  maxSpeed?: number;
}

export function ShootingStars({
  className,
  starColor = '#D4AF37',
  quantity = 1,
  minDelay = 1500,
  maxDelay = 4000,
  minSpeed = 8,
  maxSpeed = 18,
}: ShootingStarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars: Star[] = [];
    let raf: number;
    let nextStarTimer: ReturnType<typeof setTimeout>;

    function spawn() {
      const angle = Math.random() > 0.5 ? 45 : 135;
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.6,
        angle,
        speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
        size: 1.5 + Math.random() * 2,
        alpha: 1,
        trailLen: 60 + Math.random() * 80,
      });
      nextStarTimer = setTimeout(spawn, minDelay + Math.random() * (maxDelay - minDelay));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        const rad = (s.angle * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const grad = ctx.createLinearGradient(
          s.x - dx * s.trailLen, s.y - dy * s.trailLen,
          s.x, s.y
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, starColor);

        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x - dx * s.trailLen, s.y - dy * s.trailLen);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();

        s.x += dx * s.speed;
        s.y += dy * s.speed;
        s.alpha -= 0.006;

        if (s.alpha <= 0 || s.x > canvas.width + 100 || s.y > canvas.height + 100) {
          stars.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(draw);
    }

    spawn();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(nextStarTimer);
      window.removeEventListener('resize', resize);
    };
  }, [starColor, minDelay, maxDelay, minSpeed, maxSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  );
}
