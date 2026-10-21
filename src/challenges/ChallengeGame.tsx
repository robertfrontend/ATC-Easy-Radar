import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AIRPORTS } from '../config/airports';
import { GamePage, GamePageProps } from '../components/GamePage';
import { getIntensity, isLevelUnlocked, nextLevel } from './model';
import { useChallengeProgress } from './useChallengeProgress';

export type GameServices = Pick<GamePageProps, 'highScore' | 'onSave' | 'onScoreUpdate'>;
export function ChallengeGame(services: GameServices) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const airport = AIRPORTS.find(item => item.id === params.get('airport'));
  const level = Number(params.get('level') ?? 1);
  const { progress, storageError, recordCompletion } = useChallengeProgress();
  if (!airport || !getIntensity(airport.id, level) || !isLevelUnlocked(progress, airport.id, level)) {
    return <main className="p-8 space-y-4"><h1>Nivel no disponible</h1><p>Elige un aeropuerto y completa los niveles anteriores.</p><Link to="/challenges">Volver a Retos</Link></main>;
  }
  const following = nextLevel(level);
  return <>
    {storageError && <p role="alert" className="fixed top-0 left-0 right-0 z-60 bg-conflict-banner text-ink-bright p-3">No se pudo guardar el progreso. El desbloqueo funciona en esta sesión, pero podría perderse al recargar.</p>}
    <GamePage {...services} key={`${airport.id}-${level}`} airport={airport} mode="challenge" difficulty="easy" challengeLevel={level}
      onExit={() => navigate(`/challenges?airport=${airport.id}`)}
      onChallengeComplete={() => recordCompletion(airport.id, level)}
      onNextChallenge={following === null || !isLevelUnlocked(progress, airport.id, following) ? undefined : () => navigate(`/game?mode=challenge&airport=${airport.id}&level=${following}`)} />
  </>;
}
