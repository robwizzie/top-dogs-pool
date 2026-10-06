/**
 * The three-shade billiard lamp hanging over the hero, its cone of light,
 * and dust drifting through the beam. Purely decorative; server-rendered.
 */

// Fixed mote layout (left %, top %, drift px, duration s, delay s) so server
// and client markup match and the scene looks the same on every load.
const MOTES: [number, number, number, number, number][] = [
  [34, 38, 18, 11, 0],
  [42, 62, -14, 9, 1.5],
  [48, 30, 22, 12, 3],
  [55, 70, -20, 10, 0.8],
  [61, 44, 12, 13, 2.2],
  [38, 82, 26, 9.5, 4],
  [66, 76, -10, 11.5, 5.2],
  [51, 54, 16, 10.5, 6],
  [45, 88, -24, 12.5, 2.8],
  [58, 24, 10, 9, 7],
  [30, 64, 20, 13, 3.6],
  [70, 58, -18, 10, 1],
];

function Shade({ x }: { x: number }) {
  return (
    <g>
      {/* neck */}
      <rect x={x - 5} y={42} width={10} height={10} rx={2} fill="url(#lamp-brass)" />
      {/* bell */}
      <path
        d={`M ${x - 12} 52 C ${x - 30} 60, ${x - 58} 92, ${x - 72} 118 L ${x + 72} 118 C ${x + 58} 92, ${x + 30} 60, ${x + 12} 52 Z`}
        fill="url(#lamp-glass)"
      />
      {/* sheen */}
      <path
        d={`M ${x - 10} 56 C ${x - 26} 66, ${x - 44} 88, ${x - 54} 110`}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      {/* rim */}
      <ellipse cx={x} cy={118} rx={73} ry={5} fill="url(#lamp-brass)" />
      {/* glowing bulb opening */}
      <ellipse cx={x} cy={121} rx={62} ry={6} fill="#fff4d6" filter="url(#lamp-glow)" />
    </g>
  );
}

export function BilliardLamp({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {/* Light cone */}
      <div className="pm-cone absolute left-1/2 top-[70px] h-[640px] w-[min(1500px,160vw)] -translate-x-1/2 sm:top-[100px]" />

      {/* Dust in the beam */}
      <div className="absolute left-1/2 top-[90px] h-[560px] w-[min(1100px,120vw)] -translate-x-1/2 sm:top-[120px]">
        {MOTES.map(([l, t, dx, dur, delay], i) => (
          <span
            key={i}
            className="pm-mote"
            style={
              {
                left: `${l}%`,
                top: `${t}%`,
                "--dx": `${dx}px`,
                "--t": `${dur}s`,
                "--d": `${delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Fixture */}
      <div className="pm-sway absolute left-1/2 top-0 w-[min(560px,92vw)] -translate-x-1/2">
        <svg viewBox="0 0 600 132" className="block w-full overflow-visible drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]">
          <defs>
            <linearGradient id="lamp-brass" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#f6dd9a" />
              <stop offset="0.5" stopColor="#c9a24a" />
              <stop offset="1" stopColor="#7a5f24" />
            </linearGradient>
            <linearGradient id="lamp-glass" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#0d3a26" />
              <stop offset="0.65" stopColor="#14563a" />
              <stop offset="1" stopColor="#1f7a50" />
            </linearGradient>
            <filter id="lamp-glow" x="-50%" y="-200%" width="200%" height="500%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          {/* rods up into the ceiling */}
          <rect x={148} y={-400} width={3} height={438} fill="url(#lamp-brass)" />
          <rect x={449} y={-400} width={3} height={438} fill="url(#lamp-brass)" />
          {/* bar */}
          <rect x={70} y={36} width={460} height={9} rx={4.5} fill="url(#lamp-brass)" />
          <circle cx={70} cy={40.5} r={7} fill="url(#lamp-brass)" />
          <circle cx={530} cy={40.5} r={7} fill="url(#lamp-brass)" />
          <Shade x={150} />
          <Shade x={300} />
          <Shade x={450} />
        </svg>
      </div>
    </div>
  );
}
