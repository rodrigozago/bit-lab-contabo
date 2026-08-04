// Overlay de grain/noise fixo, mix-blend-mode: hard-light — o mesmo
// tratamento do 2xa.studio. SVG turbulence inline em vez de um PNG
// exportado: zero asset binário pra versionar, mesmo resultado visual.
export function Grain() {
  return (
    <svg
      className="grain-overlay"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="grain-noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="2"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-noise)" />
    </svg>
  );
}
