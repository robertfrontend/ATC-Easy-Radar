import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { glossary, glossarySource, lessons, ModuleId, sections, sourceDate } from './content';
import { canPractice, Evidence, PROGRESS_KEY, progressLabel, readProgress, recordEvidence } from './progress';
import { LearningPractice } from './LearningPractice';
import './learning.css';

const pages = ['start', 'fundamentals', 'control', 'operations', 'communications', 'practice', 'reference'];
const lessonUrl = (id: ModuleId) => `/learning/module/${id}`;

export function LearningPage() {
  const { '*': path = '' } = useParams();
  const page = path || 'start';
  const lesson = lessons.find(item => page === `module/${item.id}`);
  const location = useLocation();
  const practice = new URLSearchParams(location.search).get('practice') === '1';
  const [progress, setProgress] = useState(() => {
    try { return readProgress(localStorage.getItem(PROGRESS_KEY)); }
    catch { return readProgress(null); }
  });
  const [storageError, setStorageError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mark = (id: ModuleId, evidence: Evidence) => setProgress(previous => recordEvidence(previous, id, evidence));
  const available = lesson && canPractice(progress, lesson.id);

  useEffect(() => {
    const originalTitle = document.title;
    return () => { document.title = originalTitle; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [progress]);

  useEffect(() => {
    if (lesson) mark(lesson.id, 'consulted');
    if (lesson && practice && available) mark(lesson.id, 'started');
  }, [lesson?.id, practice, available]);

  useEffect(() => {
    if (!practice || !available) headingRef.current?.focus();
    setMenuOpen(false);
    document.title = `${lesson?.title ?? 'Learning'} | ATC Easy Radar`;
  }, [location.key]);

  const sectionIndex = lesson ? sections.indexOf(lesson.section) : pages.indexOf(page);
  const title = lesson?.title ?? sections[sectionIndex] ?? 'Página no encontrada';
  const moduleIndex = lesson ? lessons.indexOf(lesson) : -1;
  const demonstrated = lessons.filter(item => progress.modules[item.id]?.includes('demonstrated')).length;
  const list = (items = lessons) => <ol className="learning-route">{items.map(item => <li key={item.id}>
    <Link to={lessonUrl(item.id)}>{lessons.indexOf(item) + 1}. {item.title}</Link>
    <span>{progressLabel(progress, item.id)}{!item.practice ? ' · Práctica pendiente' : ''}</span>
  </li>)}</ol>;

  return <div className="learning" lang="es">
    <a className="learning-skip" href="#learning-content">Saltar al contenido</a>
    <header className="learning-header"><Link to="/">Home</Link><Link to="/learning">Learning</Link>
      <span>{demonstrated}/3 ejercicios demostrados</span></header>
    <div className="learning-layout">
      <aside className="learning-sidebar">
        <div className="learning-sidebar-content">
        <button className="learning-menu" aria-expanded={menuOpen} aria-controls="learning-nav" onClick={() => setMenuOpen(value => !value)}>Menú Learning</button>
        <nav id="learning-nav" aria-label="Secciones de Learning" className={menuOpen ? 'is-open' : ''}>
          {sections.map((section, index) => <Link key={section} to={`/learning/${pages[index]}`}
            aria-current={index === sectionIndex ? 'page' : undefined}>{section}</Link>)}
        </nav>
        <p>Consulta libre. Las prácticas 2 y 3 requieren demostrar las anteriores.</p>
        </div>
      </aside>
      <main id="learning-content" className="learning-content">
        <p className="learning-context">Learning{lesson ? ` / Módulo ${moduleIndex + 1} de 8` : ''}</p>
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
        {storageError && <p role="alert">No se pudo guardar el progreso local. Puedes seguir practicando en esta sesión; al recargar podría perderse.</p>}
        {lesson ? <>
          <p className="learning-evidence">{progressLabel(progress, lesson.id)}</p>
          <h2>Explicación</h2><p>{lesson.explanation}</p>
          <h2>Ejemplo</h2><blockquote>{lesson.example}</blockquote>
          <h2>Qué comprobar</h2><p>{lesson.takeaway}</p>
          <p><a href={lesson.source} target="_blank" rel="noreferrer">FAA JO 7110.65BB · {lesson.paragraphs}</a></p>
          {lesson.practice ? available ? <>
            {!practice && <Link className="learning-action" to={`${lessonUrl(lesson.id)}?practice=1`}>Practicar en el radar</Link>}
            {practice && <LearningPractice key={`${lesson.id}-${location.key}`} id={lesson.id} onComplete={() => mark(lesson.id, 'demonstrated')} />}
          </> : <p className="learning-note">Para practicar, demuestra primero los módulos anteriores. Puedes consultar todo el contenido y volver a <Link to={lessonUrl(lessons[moduleIndex - 1].id)}>la práctica anterior</Link>.</p>
            : <p className="learning-note">Introducción conceptual. Práctica avanzada pendiente; este módulo no se puede marcar como demostrado.</p>}
          <nav className="learning-pagination" aria-label="Ruta recomendada">
            <Link to={moduleIndex > 0 ? lessonUrl(lessons[moduleIndex - 1].id) : '/learning'}>Anterior: {moduleIndex > 0 ? `módulo ${moduleIndex}` : 'Get Started'}</Link>
            <Link to={moduleIndex < 7 ? lessonUrl(lessons[moduleIndex + 1].id) : '/learning/reference'}>Siguiente: {moduleIndex < 7 ? `módulo ${moduleIndex + 2}` : 'Referencia'}</Link>
          </nav>
        </> : page === 'start' ? <>
          <p className="learning-lead">Aprende a mirar antes de ordenar.</p>
          <p>Empieza desde cero: comprende el puesto radar, lee el tráfico y cierra el ciclo de comunicación. Español con inglés aeronáutico gradual.</p>
          <p className="learning-note">Simulación educativa, no formación acreditada ni certificación FAA. Sector terminal ficticio, llegadas IFR de ala fija y una pista. No es una carta oficial ni una guía para operar aeronaves. Sin revisión profesional acreditada.</p>
          <h2>Empieza por los módulos 1–2</h2>
          <p>Observa las prioridades y distingue selección de identificación. Después practica readback en el módulo 3. No necesitas micrófono.</p>
          <Link className="learning-action" to={lessonUrl('position')}>Comenzar módulo 1</Link>
          <h2>Ruta recomendada</h2>{list()}
          <p>Consultado: abriste la explicación. Iniciado: entraste en una práctica. Demostrado: completaste todas sus comprobaciones guiadas. Ningún estado acredita dominio operacional.</p>
          <p>El progreso se guarda solo en este navegador. Una práctica interrumpida se reinicia de forma reproducible; conserva las demostraciones completadas.</p>
        </> : page === 'fundamentals' || page === 'reference' ? <>
          <p>Lee estas distinciones antes de interpretar las etiquetas del radar.</p>
          <dl>{glossary.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
          {page === 'reference' ? <>
            <h2>Fuentes y límites</h2><p>Comprobadas el {sourceDate}. FAA JO 7110.65BB y Pilot/Controller Glossary, Change 3, efectivos el 9 de julio de 2026. Cada módulo enlaza su apartado. Consulta también avisos y procedimientos aplicables; Learning no sustituye las fuentes operacionales.</p>
            <p><a href="https://www.faa.gov/air_traffic/publications/" target="_blank" rel="noreferrer">Publicaciones oficiales FAA</a> · <a href={glossarySource} target="_blank" rel="noreferrer">Pilot/Controller Glossary</a></p>
            <p>Los umbrales, halos y automatismos del juego no son mínimos FAA universales. No modelamos meteorología, terreno, estela, fallos de radio ni coordinación real. Captura ILS, autorización de aproximación y autorización de aterrizaje no son equivalentes.</p>
          </> : <Link to={lessonUrl('identify')}>Aplicar la lectura en el módulo 2</Link>}
        </> : page === 'practice' ? <>
          <p>Repite los mismos escenarios guiados. No se puntúa rapidez. Los errores ofrecen explicación y requieren corregir la decisión antes de avanzar.</p>
          {list(lessons.slice(0, 3))}
          <p>Identidad dudosa, compresión de llegadas, transferencia con coordinación pendiente, variantes y debrief/replay: pendientes.</p>
        </> : sectionIndex >= 0 ? <>
          <p>{page === 'operations' ? 'Llegadas, aproximación y coordinación. Salidas es contenido futuro.' : 'Consulta los módulos y sigue la ruta recomendada cuando quieras practicar.'}</p>
          {list(lessons.filter(item => item.section === sections[sectionIndex]))}
        </> : <Link to="/learning">Volver a Get Started</Link>}
        <footer className="learning-footer">Observar · anticipar · planificar · comunicar · comprobar</footer>
      </main>
    </div>
  </div>;
}
