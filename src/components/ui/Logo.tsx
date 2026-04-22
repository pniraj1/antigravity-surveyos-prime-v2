'use client';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

interface LogoProps {
  /** 'light' = amber mark + dark text (for light backgrounds)
   *  'dark'  = amber mark + white text (for dark backgrounds) */
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

/** Standalone hexagonal S-mark SVG — works at any size */
export function LogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SurveyOS logo mark"
    >
      {/* Pointy-top hexagon */}
      <polygon
        points="20,3 34.72,11.5 34.72,28.5 20,37 5.28,28.5 5.28,11.5"
        fill="#F59E0B"
      />
      {/* Inner shadow / depth */}
      <polygon
        points="20,3 34.72,11.5 34.72,28.5 20,37 5.28,28.5 5.28,11.5"
        fill="url(#hexShine)"
        opacity="0.3"
      />
      <defs>
        <linearGradient id="hexShine" x1="5" y1="3" x2="35" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* S mark — stroke-based so it reads at all sizes */}
      <path
        d="M 26,13.5
           C 26,10.5 23.5,9 20,9
           C 15.5,9 13.5,11.5 13.5,15
           C 13.5,18 16.5,19.5 19.5,20.5
           C 23,21.5 26.5,23.5 26.5,27
           C 26.5,30 24,31 20,31
           C 16,31 13.5,29.5 13.5,26.5"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const SIZE_MAP = {
  sm: { mark: 24, text: 'text-base' },
  md: { mark: 32, text: 'text-xl' },
  lg: { mark: 44, text: 'text-3xl' },
} as const;

/** Full logo: hexagonal mark + "SurveyOS." wordmark */
export default function Logo({
  variant = 'light',
  size = 'md',
  showWordmark = true,
  className = '',
}: LogoProps) {
  const { mark, text } = SIZE_MAP[size];
  const textColor = variant === 'dark' ? 'text-white' : 'text-gray-900';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={mark} />
      {showWordmark && (
        <span className={`font-black tracking-tight leading-none ${text} ${textColor}`}>
          SurveyOS<span className="text-amber-500">.</span>
        </span>
      )}
    </div>
  );
}
