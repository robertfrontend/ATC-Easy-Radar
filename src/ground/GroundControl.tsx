import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Plane, CircleAlert, Check, X } from 'lucide-react';
import { GroundMap } from './GroundMap';
import { useGroundGame } from './useGroundGame';
import { getAircraftActions, getGroundAlerts, runwayOccupancy } from './simulation';
import type { AircraftAction, Phase } from './model';
import './ground.css';
import { arrivalInstruction } from './presentation';

const phaseLabels: Record<Phase, string> = {
  parked: 'Parked · awaiting taxi', taxiing: 'Taxiing', stopped: 'Stopped',
  'crossing-hold': 'Holding before runway crossing', crossing: 'Crossing runway',
  holding: 'Holding short · awaiting takeoff', 'taking-off': 'Taking off',
  approach: 'Approach · awaiting landing', 'go-around': 'Go-around · returning to approach',
  landing: 'Landing / decelerating', exiting: 'Exiting runway',
  'awaiting-taxi': 'Runway clear · awaiting taxi', turnaround: 'At stand · arrival completed',
};
const wholeSeconds = (seconds: number) => Math.floor(seconds + 1e-7);
const formatTime = (seconds: number) => `${Math.floor(wholeSeconds(seconds) / 60).toString().padStart(2, '0')}:${(wholeSeconds(seconds) % 60).toString().padStart(2, '0')}`;
const actionLabel = (action: AircraftAction) => action.type === 'stop' ? 'Stop taxi' : action.type === 'resume' ? 'Resume taxi' : action.label;

export function GroundControl() {
  const { state, dispatch } = useGroundGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const selected = state.aircraft.find(aircraft => aircraft.id === selectedId);
  const actions = selected ? getAircraftActions(state, selected.id) : [];
  const alerts = getGroundAlerts(state);
  const occupancy = runwayOccupancy(state);
  const completed = state.operations.arrivals + state.operations.departures;
  const pending = state.aircraft.filter(aircraft => aircraft.phase !== 'turnaround').length;
  const score = Math.max(0, completed * 100 - Math.floor(state.totalDelay));
  const reset = () => { dispatch({ type: 'restart' }); setSelectedId(null); };
  const closeControls = () => {
    const aircraft = mapStageRef.current?.querySelector<SVGGElement>(`[data-aircraft-id="${selectedId}"]`);
    setSelectedId(null);
    aircraft?.focus();
  };

  return <main className="ground-control">
    <header className="ground-header">
      <div className="ground-heading">
        <Link to="/" className="ground-back"><ArrowLeft size={17} aria-hidden="true" />Back to modes</Link>
        <h1>Ground Control</h1>
        <p>Willow Field <span>Airport surface operations</span></p>
      </div>
      <div className="ground-clock" data-elapsed={wholeSeconds(state.elapsed)}>
        <span>{state.shift === 'open' ? 'Traffic window' : state.shift === 'closing' ? 'Closing · clear pending flights' : 'Shift complete'}</span>
        <strong>{formatTime(Math.min(state.elapsed, 480))}<small> / 08:00</small></strong>
        {state.shift === 'closing' && <span>Overtime {formatTime(state.elapsed - 480)}</span>}
      </div>
      <div className="ground-clock-controls" aria-label="Simulation controls">
        <button type="button" onClick={() => dispatch({ type: 'pause' })} disabled={state.shift === 'complete'}>
          {state.paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{state.paused ? 'Resume' : 'Pause'}
        </button>
        <div className="ground-speeds" role="group" aria-label="Simulation speed">
          {([1, 2] as const).map(speed => <button key={speed} type="button" aria-pressed={state.speed === speed}
            onClick={() => dispatch({ type: 'speed', speed })}>{speed}×</button>)}
        </div>
        <button type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" />Restart</button>
      </div>
    </header>

    <section className="ground-statistics" aria-label="Shift statistics">
      <div><strong>{completed}</strong><span>Operations <small>{state.operations.departures} departures / {state.operations.arrivals} arrivals</small></span></div>
      <div><strong>{pending}</strong><span>Pending <small>Active flights to resolve</small></span></div>
      <div><strong>{Math.floor(state.totalDelay)}<small>s</small></strong><span>Delay <small>Total aircraft-seconds</small></span></div>
      <div><strong>{score}</strong><span>Performance <small>100 per operation − delay seconds</small></span></div>
    </section>

    {state.shift === 'complete' && <section className="ground-summary" aria-label="Final evaluation">
      <Check size={24} aria-hidden="true" /><div><h2>Shift complete</h2><p>{completed} operations completed with {Math.floor(state.totalDelay)} aircraft-seconds of delay. Final performance: {score}.</p>
        <p>{state.totalDelay < 60 ? 'A well-paced shift. Your traffic is clear.' : 'Traffic is clear. Try reducing time spent at holds next shift.'}</p></div>
      <button type="button" onClick={reset}>Start another shift</button>
    </section>}

    <div className="ground-workspace">
      <section className="ground-airport" aria-label="Airport surface">
        <div className="ground-map-toolbar">
          <span><span className="ground-status-symbol" aria-hidden="true">{state.paused ? 'Ⅱ' : '●'}</span>{state.paused ? 'Simulation paused' : state.shift === 'complete' ? 'Traffic clear' : 'Surface live'}</span>
          <span>09/27 + 18/36 <small>Shared intersection</small></span>
        </div>
        <div className="ground-map-stage" data-ground-map-stage ref={mapStageRef}>
          <GroundMap state={state} selectedId={selectedId} onSelect={setSelectedId} />
          {selected && <section className="ground-aircraft-controls" aria-label="Selected aircraft"
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeControls(); } }}>
            <header className="ground-command-heading">
              <div><strong>{selected.id}</strong><p>{phaseLabels[selected.phase]}</p></div>
              <button type="button" className="ground-command-close" aria-label="Close aircraft controls" onClick={closeControls}>
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="ground-actions">
              {actions.map(action => <div key={`${action.type}-${action.runway ?? ''}`}>
                <button type="button" data-command={action.type} data-target-runway={action.runway}
                  disabled={!!action.blocked || state.paused || state.shift === 'complete'}
                  aria-describedby={state.paused ? 'ground-paused-reason' : action.blocked ? `ground-reason-${action.type}-${action.runway ?? ''}` : undefined}
                  onClick={() => dispatch({ type: action.type, id: selected.id, runway: action.runway })}>
                  {actionLabel(action)}
                </button>
                {action.blocked && !state.paused && <p id={`ground-reason-${action.type}-${action.runway ?? ''}`} className="ground-action-reason">{action.blocked}</p>}
              </div>)}
            </div>
            {selected.blocked && <p className="ground-command-note">{selected.blocked}</p>}
            {state.paused && <p id="ground-paused-reason" className="ground-command-note">Resume the simulation to issue clearances.</p>}
            {!actions.length && <p className="ground-command-note">{selected.phase === 'go-around'
              ? 'Landing clearance becomes available when the aircraft returns to approach.'
              : arrivalInstruction(selected) || 'Completing the current clearance. No action needed.'}</p>}
          </section>}
        </div>
        <div className="ground-legend" aria-label="Map legend">
          <span><Plane size={16} aria-hidden="true" />Aircraft</span>
          <span><i className="ground-legend-route" aria-hidden="true" />Selected route</span>
          <span><b aria-hidden="true">‖</b>Hold short</span>
          <span><i className="ground-legend-reserved" aria-hidden="true" />Reserved runway</span>
        </div>
      </section>

      <aside className="ground-sidebar" aria-label="Ground control desk">
        <section className="ground-panel ground-runway-status" aria-label="Runway status">
          <h2>Runway status</h2>
          {(['09', '36'] as const).map(id => <div key={id}>
            <strong>{id}/{id === '09' ? '27' : '18'}</strong>
            <span>{occupancy[id].length ? `■ Occupied: ${occupancy[id].join(', ')}` : state.reservation ? `▧ Reserved: ${state.reservation.owner}` : '✓ Clear'}</span>
          </div>)}
          <p>{state.reservation ? `Shared intersection reserved for ${state.reservation.owner}.` : 'Shared intersection available.'}</p>
        </section>

        <section className="ground-panel ground-flight-list" aria-label="Flight list">
          <h2>Flights <span>{state.aircraft.length}</span></h2>
          {state.aircraft.length ? <ul>{state.aircraft.map(aircraft => <li key={aircraft.id}>
            <button type="button" data-flight-kind={aircraft.kind} data-flight-id={aircraft.id} aria-pressed={selectedId === aircraft.id}
              onClick={() => setSelectedId(aircraft.id)}>
              <span><strong>{aircraft.id}</strong><small>{aircraft.kind === 'arrival' ? '↓ Arrival' : '↑ Departure'}</small></span>
              <span className="ground-list-phase">{phaseLabels[aircraft.phase]}</span>
              {aircraft.kind === 'arrival' && ['approach', 'awaiting-taxi', 'crossing-hold'].includes(aircraft.phase) && <span className="ground-next-clearance">{aircraft.phase === 'approach' ? 'Landing clearance needed' : aircraft.phase === 'awaiting-taxi' ? 'Taxi to gate clearance needed' : 'Runway crossing clearance needed'}</span>}
            </button>
          </li>)}</ul> : <p>No pending aircraft. Start another shift to play again.</p>}
        </section>
      </aside>
    </div>

    <section className="ground-messages" aria-label="Traffic messages" aria-live="polite" aria-atomic="true">
      <p><CircleAlert size={16} aria-hidden="true" />{state.message}</p>
      {alerts.slice(0, 3).map(alert => <p key={alert.id} className={alert.severity === 'warning' ? 'ground-warning' : ''}>{alert.severity === 'warning' ? '⚠' : '•'} {alert.message}</p>)}
    </section>
    <details className="ground-instructions" open>
      <summary>How to play this shift</summary>
      <div>
        <p><strong>Taxi clearance is not runway clearance.</strong> Select GC101 and taxi to runway 09. It will stop at the hold. Then authorize takeoff when the runway is available.</p>
        <p>Authorize GC202 to land. It will decelerate and exit automatically. After “Runway clear”, authorize taxi to its reserved stand; authorize any marked runway crossing separately.</p>
        <p>Runways share an intersection: one landing, takeoff or crossing reservation at a time. Dashed outlines mean reserved, even before physical occupancy. Taxi queues wait automatically; stopping the lead aircraft delays the queue.</p>
        <p>Each continuous wait has 30 free simulated seconds; every second after that adds delay. Moving resets the waiting allowance. Operations score once, arrivals at their stand and departures after takeoff. Pause freezes traffic and delays; 2× advances both equally.</p>
        <p>New traffic increases gradually for eight simulated minutes, then stops. Resolve all pending flights to finish. There is no early defeat. Restart resets the same initial scenario; leaving discards this shift without affecting radar records.</p>
      </div>
    </details>
  </main>;
}
