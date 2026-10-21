import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AIRPORTS } from '../config/airports';
import { getIntensity, isLevelUnlocked } from './model';
import { useChallengeProgress } from './useChallengeProgress';

export function ChallengeSelector() {
  const [params, setParams] = useSearchParams();
  const airport = AIRPORTS.find(item => item.id === params.get('airport')) ?? AIRPORTS[0];
  const [level, setLevel] = useState(1);
  const { progress } = useChallengeProgress();
  const profile = getIntensity(airport.id, level)!;
  const completed = progress.completed[airport.id] ?? 0;
  return <main lang="es" className="min-h-screen bg-scope text-ink px-4 py-8 md:p-10">
    <div className="max-w-4xl mx-auto space-y-6">
      <nav aria-label="Modos independientes" className="flex gap-5"><Link to="/">Home / modo libre</Link><Link to="/learning">Learning</Link></nav>
      <h1 className="text-3xl font-bold text-ink-bright">Retos por intensidad</h1>
      <p>20 niveles por aeropuerto. Turnos completos de cinco minutos de simulación activa; pausa y menús no consumen tiempo. Repite cualquier nivel desbloqueado.</p>
      <label className="block">Aeropuerto
        <select className="block w-full mt-2 bg-panel border border-line-strong rounded p-3" value={airport.id}
          onChange={event => { setParams({ airport: event.target.value }); setLevel(1); }}>
          {AIRPORTS.map(item => <option key={item.id} value={item.id}>{item.icao} · {item.name}</option>)}
        </select>
      </label>
      <p aria-live="polite">{completed}/20 completados en {airport.icao}. Nivel 1 disponible desde el inicio en cada aeropuerto.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3" role="group" aria-label="Niveles de intensidad">
        {Array.from({ length: 20 }, (_, index) => index + 1).map(number => {
          const unlocked = isLevelUnlocked(progress, airport.id, number);
          const status = number <= completed ? 'Completado' : unlocked ? 'Disponible' : 'Bloqueado';
          return <button key={number} disabled={!unlocked} aria-pressed={level === number} onClick={() => setLevel(number)}
            className={`border rounded p-3 text-left disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-selected ${level === number ? 'border-phosphor bg-panel-raised' : 'border-line bg-panel'}`}>
            <strong className="block">Nivel {number}</strong><span className="text-sm">{status}</span>
          </button>;
        })}
      </div>
      <section aria-label="Objetivo del nivel" className="border border-line-strong bg-panel rounded p-5 space-y-3">
        <h2 className="text-xl font-bold text-ink-bright">{airport.icao} · Nivel {level}</h2>
        <p>{profile.description}</p>
        <p>Entrada prevista cada {(profile.spawnIntervalMs / 1000).toFixed(1)} s, hasta {profile.maxPlanes} tráficos activos; aproximadamente {Math.round(profile.departureProbability * 100)}% salidas cuando la pista permite salir. Una entrada insegura se retrasa.</p>
        <p>Para aprobar: cinco minutos completos, cero accidentes y al menos <strong>{profile.minimumOperations} {profile.minimumOperations === 1 ? 'operación efectiva' : 'operaciones efectivas'}</strong>. Solo cuentan aterrizajes o salidas completadas de aeronaves a las que hayas transmitido una orden.</p>
        <p>Pista fija {airport.runways[0].label} para llegadas y salidas, velocidad 1× y reglas constantes. Alcanzar el mínimo no termina el turno.</p>
        <Link className="inline-block rounded bg-phosphor text-scope font-bold px-5 py-3 focus-visible:outline-2 focus-visible:outline-selected"
          to={`/game?mode=challenge&airport=${airport.id}&level=${level}`}>Iniciar nivel {level}</Link>
      </section>
      <p className="text-sm text-ink-dim">Balance inicial ajustable. Geometrías simplificadas del juego; no es entrenamiento FAA. Progreso local independiente de Learning y de las partidas guardadas.</p>
    </div>
  </main>;
}
