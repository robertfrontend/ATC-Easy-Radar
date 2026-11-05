/** Original top-down airframes, facing east before the outer heading rotation. */
export function AircraftShape({ twin }: { twin: boolean }) {
  return <g stroke="#36494c" strokeWidth={0.8} strokeLinejoin="round">
    {twin ? <>
      <path d="M 4 -3 L -4 -17 L -9 -17 L -5 -2 L -5 2 L -9 17 L -4 17 L 4 3 Z" fill="#cad4d5" />
      <path d="M -12 -2 L -17 -10 L -20 -10 L -17 0 L -20 10 L -17 10 L -12 2 Z" fill="#e3e9e7" />
      {[-9, 9].map(y => <g key={y} data-engine={y < 0 ? 'left' : 'right'}>
        <rect x={-5} y={y - 2.8} width={11} height={5.6} rx={2.5} fill="#f8faf7" />
        <path d={`M 4 ${y - 2} V ${y + 2}`} stroke="#30454e" strokeWidth={2} />
      </g>)}
      <path d="M 20 0 Q 17 -4 11 -4 L -13 -3 Q -18 -2 -20 0 Q -18 2 -13 3 L 11 4 Q 17 4 20 0 Z" fill="#f5f6ef" />
      <path d="M 13 -2.5 L 16 -1 L 16 1 L 13 2.5 L 11 1.7 L 11 -1.7 Z" fill="#375866" stroke="none" />
      <path d="M -19 0 L -10 0" stroke="#5b859c" strokeWidth={2.5} />
      {[0, 3, 6, 9].map(x => <g key={x} fill="#54727d" stroke="none"><rect x={x} y={-3.1} width={1.2} height={0.9} /><rect x={x} y={2.2} width={1.2} height={0.9} /></g>)}
    </> : <>
      <path d="M 3 -2 L 1 -14 L -4 -14 L -3 -2 L -3 2 L -4 14 L 1 14 L 3 2 Z" fill="#d0d9d9" />
      <path d="M -8 -1 L -11 -7 L -14 -7 L -12 0 L -14 7 L -11 7 L -8 1 Z" fill="#eef0e7" />
      <path d="M 12 0 Q 10 -3 6 -3 L -9 -1.8 L -14 0 L -9 1.8 L 6 3 Q 10 3 12 0 Z" fill="#f5f6ef" />
      <rect data-engine="nose" x={8} y={-2.5} width={5} height={5} rx={1.8} fill="#9eb3bc" />
      <path d="M 13 -7 V 7" stroke="#dce6e2" strokeWidth={1.6} />
      <path d="M 3 -2 L 7 -1.5 L 7 1.5 L 3 2 Z" fill="#375866" stroke="none" />
      <path d="M -13 0 H -7" stroke="#5b859c" strokeWidth={2} />
    </>}
  </g>;
}
