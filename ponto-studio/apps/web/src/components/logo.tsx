import * as React from "react"
import { useTheme } from "@/components/theme-provider"

interface LogoProps extends React.HTMLAttributes<HTMLImageElement> {
  size?: number
  variant?: "default" | "transparent"
}

/**
 * Marca do Ponto Studio — logo PNG com suporte a dark mode.
 * - light: logo.png (padrão, fundo branco)
 * - dark: logo-dark.png (fundo escuro)
 * - transparent: logo-transparent.png (sem fundo)
 */
export function Logo({ size = 40, className, variant = "default", ...props }: LogoProps) {
  const { theme } = useTheme()

  const src = variant === "transparent"
    ? "/logo-transparent.png"
    : theme === "dark"
      ? "/logo-dark.png"
      : "/logo.png"

  return (
    <img
      src={src}
      alt="Ponto Studio"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
      {...props}
    />
  )
}
