import * as React from "react"

interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number
}

/** Marca do Ponto Studio — o 🪡 no mesmo papel do Logo SVG do template. */
export function Logo({ size = 24, className, style, ...props }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Ponto Studio"
      className={className}
      style={{ fontSize: size * 0.8, lineHeight: 1, ...style }}
      {...props}
    >
      🪡
    </span>
  )
}
