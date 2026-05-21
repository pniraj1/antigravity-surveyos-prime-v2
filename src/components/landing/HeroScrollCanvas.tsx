'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent, MotionValue } from 'framer-motion';

const FRAME_COUNT = 290;
const FRAME_PREFIX = '/video-frames/ezgif-frame-';
const FRAME_EXTENSION = '.png';

interface HeroScrollCanvasProps {
  /** If provided, this scrollYProgress (0-1) drives the frame. Otherwise window scroll is used. */
  externalScrollYProgress?: MotionValue<number>;
}

export default function HeroScrollCanvas({ externalScrollYProgress }: HeroScrollCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const dprRef = useRef<number>(1);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Fallback to window scroll if no external progress is passed
  const { scrollYProgress: windowScrollYProgress, scrollY } = useScroll();
  const activeProgress = externalScrollYProgress ?? windowScrollYProgress;

  // Parallax scale/radius only when using window scroll (right sticky column context)
  const scale = useTransform(scrollY, [0, 600], [0.9, 1]);
  const borderRadius = useTransform(scrollY, [0, 600], ['28px', '0px']);

  // Preload all frames — PARALLEL strategy
  // Fires all 290 requests simultaneously. Browser queues ~6 concurrent per domain.
  // Frame 1 becomes visible the instant it downloads (~100ms), not after all 290 load.
  useEffect(() => {
    const preloadImages = () => {
      // Pre-size the array so index-based assignment works correctly
      const loadedImages = new Array<HTMLImageElement>(FRAME_COUNT);
      let loadedCount = 0;
      let firstFrameReady = false;

      const loadSingleFrame = (i: number): Promise<void> =>
        new Promise((resolve) => {
          const img = new Image();
          const frameNum = (i + 1).toString().padStart(3, '0');
          img.src = `${FRAME_PREFIX}${frameNum}${FRAME_EXTENSION}`;

          img.onload = () => {
            loadedImages[i] = img;
            loadedCount++;
            setImagesLoaded(loadedCount);

            // Make canvas visible the instant the very first frame loads
            if (!firstFrameReady && i === 0) {
              firstFrameReady = true;
              imagesRef.current = loadedImages;
              setIsReady(true);
              drawFrame(0, loadedImages);
            } else {
              // Keep ref up-to-date so scroll can use any already-loaded frame
              imagesRef.current = loadedImages;
            }

            resolve();
          };

          img.onerror = () => {
            loadedCount++;
            setImagesLoaded(loadedCount);
            resolve();
          };
        });

      // Fire all requests at once — ~6x–20x faster than sequential await
      Promise.all(
        Array.from({ length: FRAME_COUNT }, (_, i) => loadSingleFrame(i))
      ).then(() => {
        imagesRef.current = loadedImages;
        if (!firstFrameReady && loadedImages[0]) {
          setIsReady(true);
          drawFrame(0, loadedImages);
        }
      });
    };

    preloadImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawFrame = (frameIndex: number, images?: HTMLImageElement[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const src = images ?? imagesRef.current;
    const image = src[frameIndex];

    if (canvas && ctx && image) {
      // Use physical pixel dimensions (already multiplied by DPR in resizeCanvas)
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = image.width / image.height;

      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imgRatio) {
        drawHeight = canvas.width / imgRatio;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawWidth = canvas.height * imgRatio;
        offsetX = (canvas.width - drawWidth) / 2;
      }

      // High-quality rendering — prevents any software upscale blur
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    }
  };

  // Map scroll progress (0→1) to frame index (0→289)
  const currentFrame = useTransform(activeProgress, [0, 1], [0, FRAME_COUNT - 1]);

  useMotionValueEvent(currentFrame, 'change', (latest) => {
    const frameIndex = Math.min(Math.floor(latest), FRAME_COUNT - 1);
    if (imagesRef.current[frameIndex]) {
      requestAnimationFrame(() => drawFrame(frameIndex));
    }
  });

  // Resize canvas to fill container — MUST multiply by devicePixelRatio for crisp rendering on HiDPI screens
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return;

      // Store DPR so drawFrame uses physical pixel math
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;

      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;

      // Physical pixel buffer — this is what eliminates blur on Retina/HiDPI
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      // CSS display size stays at logical pixels
      canvas.style.width  = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      drawFrame(Math.min(Math.floor(currentFrame.get()), FRAME_COUNT - 1));
    };

    window.addEventListener('resize', resizeCanvas);

    const observer = new ResizeObserver(resizeCanvas);
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }

    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      observer.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
      <motion.div
        style={externalScrollYProgress ? {} : { scale, borderRadius }}
        className="w-full h-full overflow-hidden relative bg-black will-change-transform"
      >
        {/* The canvas — DPR-aware, no mix-blend-mode, sharp on all screens */}
        <canvas
          ref={canvasRef}
          style={{
            opacity: isReady ? 1 : 0,
            transition: 'opacity 0.8s ease',
            // Do NOT set width/height here — resizeCanvas manages it via style props
            // CSS object-fit equivalent is handled by our drawFrame cover-fit logic
            position: 'absolute',
            inset: 0,
          }}
        />

        {/* Lightweight vignette overlay — does NOT hide the canvas */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              linear-gradient(to bottom, rgba(5,5,10,0.55) 0%, transparent 18%, transparent 80%, rgba(5,5,10,0.65) 100%),
              linear-gradient(to right, rgba(5,5,10,0.4) 0%, transparent 30%, transparent 70%, rgba(5,5,10,0.4) 100%)
            `,
          }}
        />

        {/* Loading indicator */}
        {imagesLoaded < FRAME_COUNT && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-200 rounded-full"
                style={{ width: `${Math.round((imagesLoaded / FRAME_COUNT) * 100)}%` }}
              />
            </div>
            <span className="text-white/40 text-[10px] font-mono tracking-widest uppercase">
              Cinematic Engine {Math.round((imagesLoaded / FRAME_COUNT) * 100)}%
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
