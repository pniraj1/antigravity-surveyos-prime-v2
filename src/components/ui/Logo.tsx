'use client';

/** Oxide steps from the brand tokens — the rule must flip by ground or it
 *  fails contrast on one of them. #B03C26 reads on paper, #E2705A on ink. */
const OXIDE_ON_PAPER = '#B03C26';
const OXIDE_ON_INK   = '#E2705A';

interface LogoMarkProps {
  size?: number;
  /** Selects the oxide step for the field rule. Ink strokes use currentColor. */
  variant?: 'light' | 'dark';
  className?: string;
}

interface LogoProps {
  /** 'light' = dark text on light backgrounds
   *  'dark'  = white text on dark backgrounds */
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

/**
 * Motor SurveyOS primary mark — a bracketed form field with its ruled baseline.
 * Brackets are open (no top/bottom join) so the mark keeps air at 16px, where a
 * closed box fills in and turns into a blob. The field rule is a filled rect,
 * not a stroke, because a ruled line on a form prints solid and a stroked one
 * renders lighter at small sizes.
 */
export function LogoMark({ size = 32, variant = 'light', className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Motor SurveyOS"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        <path d="M19 8 H8 V56 H19" />
        <path d="M45 8 H56 V56 H45" />
        <path d="M21.5 40 V22.4 L32 32.6 L42.5 22.4 V40" strokeWidth="4.2" />
      </g>
      <rect
        x="21.5"
        y="45.4"
        width="21"
        height="3.1"
        fill={variant === 'dark' ? OXIDE_ON_INK : OXIDE_ON_PAPER}
      />
    </svg>
  );
}

const SIZE_MAP = {
  sm: { mark: 24, text: 'text-base' },
  md: { mark: 32, text: 'text-xl' },
  lg: { mark: 44, text: 'text-3xl' },
} as const;

/** Full logo: bracket mark + "Motor SurveyOS" wordmark */
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
      {/* textColor also drives the mark's ink, which is currentColor */}
      <LogoMark size={mark} variant={variant} className={textColor} />
      {showWordmark && (
        <span className={`font-black tracking-tight leading-none ${text} ${textColor}`}>
          Motor SurveyOS
        </span>
      )}
    </div>
  );
}
