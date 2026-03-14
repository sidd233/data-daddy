export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer hexagon ring */}
      <path
        d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
        stroke="url(#logoGrad)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
      {/* Inner data cylinder / DB stack */}
      <ellipse cx="16" cy="11" rx="6" ry="2.5" fill="url(#logoGrad)" opacity="0.9" />
      <rect x="10" y="11" width="12" height="4" fill="url(#logoGradDark)" />
      <ellipse cx="16" cy="15" rx="6" ry="2.5" fill="url(#logoGrad)" opacity="0.75" />
      <rect x="10" y="15" width="12" height="4" fill="url(#logoGradDark)" opacity="0.8" />
      <ellipse cx="16" cy="19" rx="6" ry="2.5" fill="url(#logoGrad)" opacity="0.6" />
      {/* Zap / spark accent */}
      <path
        d="M17.5 11.5L14 17H17L14.5 22.5"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <defs>
        <linearGradient id="logoGrad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5A0" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="logoGradDark" x1="10" y1="11" x2="22" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5A0" stopOpacity="0.15" />
          <stop offset="1" stopColor="#059669" stopOpacity="0.25" />
        </linearGradient>
      </defs>
    </svg>
  )
}
