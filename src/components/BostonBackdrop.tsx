import { AIRPORTS } from '../config/airports';
import { getGeographicAirport } from '../geography/kbos';
import { GeographicSector } from './GeographicSector';

const boston = getGeographicAirport(AIRPORTS.find(airport => airport.icao === 'KBOS')!);
const noActiveRunways = {};

/** Decorative, approximate terrain and runway geometry; never a gameplay or navigation display. */
export function BostonBackdrop() {
  return (
    <div className="landing-boston-backdrop" data-airport-theme="navy" data-decorative-airport="KBOS" aria-hidden="true">
      <svg viewBox="300 300 400 400" preserveAspectRatio="xMidYMid meet" focusable="false">
        <g transform="translate(0 1000) scale(1 -1)">
          <GeographicSector airport={boston} runwayConfig={noActiveRunways} annotationScale={2.6}
            showFixes={false} showLocalizers={false} />
        </g>
      </svg>
    </div>
  );
}
