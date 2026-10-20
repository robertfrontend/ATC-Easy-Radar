import { useEffect, useRef, useState } from 'react';
import { ModuleId } from './content';
import { answerStep, continueAttempt, newAttempt, other, scenarios, target } from './scenarios';
import './practice.css';

export function LearningPractice({ id, onComplete }: { id: ModuleId; onComplete: () => void }) {
  const steps = scenarios[id];
  const [attempt, setAttempt] = useState(newAttempt);
  const [selected, setSelected] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  if (!steps) return <p>Práctica avanzada pendiente.</p>;
  const step = steps[attempt.step];
  const complete = !step;
  const executed = id === 'readback' && (complete || (attempt.step === 7 && attempt.accepted));
  const turning = id === 'readback' && attempt.step === 6 && attempt.accepted;
  const heading = executed ? 90 : turning ? 75 : step?.heading ?? 60;
  const assigned = executed ? 90 : step?.assigned ?? (id === 'readback' ? 60 : heading);
  const seconds = executed ? 30 : turning ? 15 : step?.seconds ?? 0;
  const tracks = [
    { callsign: target, x: 95 + seconds * 2, y: 145 - seconds / 2, heading },
    { callsign: other, x: 405 - seconds * 2, y: 145 - seconds, heading: 300 },
  ];
  const choose = (answer: string) => setAttempt(previous => {
    if (!step?.select && id !== 'position' && selected !== target) {
      return { ...previous, feedback: 'Comprueba la selección: esta instrucción corresponde a N731KB.', mistakes: previous.mistakes + 1 };
    }
    return answerStep(previous, steps, answer);
  });
  const select = (callsign: string) => {
    setSelected(callsign);
    if (step?.select) choose(callsign);
  };
  const next = () => {
    const updated = continueAttempt(attempt, steps);
    setAttempt(updated);
    if (updated.step === steps.length) onComplete();
    headingRef.current?.focus();
  };
  const restart = () => {
    setAttempt(newAttempt());
    setSelected(null);
    headingRef.current?.focus();
  };

  return <section className="learning-practice" aria-label="Práctica guiada en el radar">
    <div className="learning-practice-heading">
      <h2 ref={headingRef} tabIndex={-1}>{complete ? 'Ejercicio completado' : `${attempt.step + 1}/${steps.length} · ${step.phase}`}</h2>
      <button onClick={restart}>Reiniciar escenario</button>
    </div>
    <p>Sector ficticio Alba · llegadas IFR de ala fija · pista 18. Mapa didáctico, no carta oficial.</p>
    <p>Tiempo por pasos: {seconds} s. Sin presión de rapidez. Sin viento; respuesta y giro deliberadamente simplificados.</p>
    <div className="learning-radar" aria-label="Radar del sector Alba">
      <svg viewBox="0 0 600 360" aria-hidden="true">
        {[70, 130, 190].map(radius => <circle key={radius} cx="300" cy="180" r={radius} />)}
        <path d="M300 10V350M20 180H580" />
        <path className="learning-runway" d="M300 235V275" />
        <text x="310" y="265">18</text><text x="300" y="25">N ↑</text>
        {id === 'identify' && <text x="95" y="125">NORDO</text>}
        {tracks.map(track => <line key={track.callsign} className="learning-track-line"
          x1={track.x} y1={track.y} x2={track.x + Math.sin(track.heading * Math.PI / 180) * 70}
          y2={track.y - Math.cos(track.heading * Math.PI / 180) * 70} />)}
      </svg>
      {tracks.map((track, index) => <button key={track.callsign}
        className="learning-target" aria-pressed={selected === track.callsign}
        style={{ left: `${track.x / 6}%`, top: `${track.y / 3.6}%` }}
        onClick={() => select(track.callsign)} disabled={complete || attempt.accepted}
        aria-label={`Seleccionar ${track.callsign}, actual 6000 pies, asignada ${index === 0 && id === 'identify' ? 5000 : 6000} pies, groundspeed 210 nudos${step?.ident && index === 0 ? ', respuesta IDENT observada' : ''}`}>
        <span aria-hidden="true">◇ </span>{track.callsign}
        <span>Actual 060 / asignada {index === 0 && id === 'identify' ? '050' : '060'}</span>
        <span>GS 210 kt · HDG {String(track.heading).padStart(3, '0')}</span>
        {index === 0 && step?.ident && <strong>IDENT observado</strong>}
      </button>)}
    </div>
    <p className="learning-strip">Selección: {selected ?? 'ninguna'} · Rumbo actual {heading.toString().padStart(3, '0')} / asignado {assigned.toString().padStart(3, '0')}</p>
    {id === 'readback' && <p role="status">Instrucción: {complete ? 'Ejecutada y comprobada: 090' : step.command}</p>}
    {complete ? <>
      <p role="status">Demostrado en ejercicio guiado. {attempt.mistakes} decisiones revisadas. Puedes repetir sin perder tu evidencia previa.</p>
      <p>Repaso: observa antes de ordenar, verifica la identidad y comprueba la respuesta. Completar este ejercicio no acredita dominio operacional.</p>
    </> : <>
      <h3>{step.prompt}</h3>
      {step.select && <p>Usa las etiquetas del radar; también puedes seleccionarlas con Tab y Enter.</p>}
      <div className="learning-choices">{step.choices.map(choice => <button key={choice}
        disabled={attempt.accepted} onClick={() => choose(choice)}>{choice}</button>)}</div>
      <p role="status" aria-live="polite">{attempt.feedback}</p>
      {attempt.accepted && <button className="learning-primary" onClick={next}>
        {attempt.step === steps.length - 1 ? 'Completar y comprobar resultado' : 'Continuar práctica'}
      </button>}
    </>}
  </section>;
}
