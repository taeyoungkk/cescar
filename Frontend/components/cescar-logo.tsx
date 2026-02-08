interface CescarLogoProps {
  className?: string
  size?: number
}

export function CescarLogo({ className = "", size = 24 }: CescarLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Crosshair outer circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />
      
      {/* Crosshair lines */}
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
      
      {/* Robot body (simplified OrinCar-like front view) */}
      <rect
        x="8"
        y="8"
        width="8"
        height="6"
        rx="1"
        fill="currentColor"
      />
      
      {/* Robot eyes */}
      <circle cx="10" cy="11" r="1" fill="var(--background, #0a0a0a)" />
      <circle cx="14" cy="11" r="1" fill="var(--background, #0a0a0a)" />
      
      {/* Robot wheels */}
      <rect
        x="7"
        y="14"
        width="2"
        height="3"
        rx="0.5"
        fill="currentColor"
      />
      <rect
        x="15"
        y="14"
        width="2"
        height="3"
        rx="0.5"
        fill="currentColor"
      />
      
      {/* Small bug inside (simplified) */}
      <circle cx="12" cy="10.5" r="0.8" fill="var(--background, #0a0a0a)" />
      <line x1="11.3" y1="10" x2="10.8" y2="9.3" stroke="var(--background, #0a0a0a)" strokeWidth="0.5" />
      <line x1="12.7" y1="10" x2="13.2" y2="9.3" stroke="var(--background, #0a0a0a)" strokeWidth="0.5" />
    </svg>
  )
}
