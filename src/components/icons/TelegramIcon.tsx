// Official Telegram logo (white paper plane on a #229ED9 blue circle), inline SVG.
interface TelegramIconProps {
  size?: number;
  className?: string;
}

export function TelegramIcon({ size = 16, className }: TelegramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="120" cy="120" r="120" fill="#229ED9" />
      <path
        fill="#fff"
        d="M53.2 117.8c34.9-15.2 58.2-25.2 69.9-30.1 33.3-13.8 40.2-16.2 44.7-16.3 1 0 3.2.2 4.7 1.4.8.7 1.4 1.6 1.6 2.6.2 1 .4 2.4.3 3.5-1.3 13.7-6.9 47-9.8 62.4-1.2 6.5-3.6 8.7-5.9 8.9-5 .5-8.8-3.3-13.6-6.5-7.6-5-11.9-8.1-19.3-13-8.5-5.6-3-8.7 1.9-13.7 1.3-1.3 23.2-21.3 23.6-23.1.1-.2.1-1.1-.4-1.5s-1.2-.3-1.8-.2c-.8.2-12.8 8.1-36.1 23.8-3.4 2.3-6.5 3.5-9.3 3.4-3.1-.1-8.9-1.8-13.3-3.2-5.4-1.7-9.6-2.7-9.3-5.7.2-1.6 2.3-3.2 6.4-4.9z"
      />
    </svg>
  );
}
