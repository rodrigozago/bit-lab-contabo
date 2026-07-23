import * as React from "react"

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number
}

export function Logo({ size = 24, className, style, ...props }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Sentinela"
      className={className}
      style={{ fontSize: size * 0.8, lineHeight: 1, ...style }}
      {...props}
    >
      🛰️
    </span>
  )
}
