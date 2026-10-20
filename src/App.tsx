import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { GamePage } from './components/GamePage';
import { SavedGame, Difficulty, RunwayConfig } from './types';
import { AIRPORTS } from './config/airports';
import { SessionMode } from './hooks/useGameLoop';

const SAVED_GAMES_KEY = 'atc_saved_games';

function loadSavedGames(): SavedGame[] {
  try {
    const raw = localStorage.getItem(SAVED_GAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedGames(games: SavedGame[]) {
  localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(games));
}

function HomePageWrapper({
  savedGames,
  highScore,
  onDeleteGame,
}: {
  savedGames: SavedGame[];
  highScore: number;
  onDeleteGame: (id: string) => void;
}) {
  const navigate = useNavigate();

  const handleStartNewGame = (diff: Difficulty, selectedAirportId: string, runwayConfig: RunwayConfig, mode: SessionMode = 'shift', goal = 10) => {
    navigate(`/game?airport=${selectedAirportId}&diff=${diff}&mode=${mode}&goal=${goal}`, {
      state: {
        difficulty: diff,
        airportId: selectedAirportId,
        runwayConfig,
        mode,
        goal,
      }
    });
  };

  return (
    <HomePage
      savedGames={savedGames}
      onNewGame={handleStartNewGame}
      onDeleteGame={onDeleteGame}
      highScore={highScore}
    />
  );
}

function GamePageWrapper({
  highScore,
  onSave,
  onScoreUpdate,
}: {
  highScore: number;
  onSave: (saveData: Omit<SavedGame, 'id' | 'savedAt'>) => void;
  onScoreUpdate: (score: number) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const state = location.state as {
    difficulty?: Difficulty;
    airportId?: string;
    runwayConfig?: RunwayConfig;
    mode?: SessionMode;
    goal?: number;
  } | null;

  const airportId = state?.airportId || searchParams.get('airport') || AIRPORTS[0].id;
  const rawDifficulty = state?.difficulty || searchParams.get('diff');
  const difficulty: Difficulty = rawDifficulty === 'medium' || rawDifficulty === 'hard' ? rawDifficulty : 'easy';
  const rawMode = state?.mode || searchParams.get('mode');
  const mode: SessionMode = rawMode === 'tutorial' || rawMode === 'shift' ? rawMode : 'free';
  const rawGoal = Number(state?.goal ?? searchParams.get('goal') ?? 10);
  const goal = Number.isInteger(rawGoal) && rawGoal >= 1 && rawGoal <= 30 ? rawGoal : 10;
  const airport = AIRPORTS.find(a => a.id === airportId) || AIRPORTS[0];

  const initialRunwayConfig: RunwayConfig = useMemo(() => {
    if (state?.runwayConfig && Object.keys(state.runwayConfig).length > 0) {
      return state.runwayConfig;
    }
    const initial: RunwayConfig = {};
    airport.runways.forEach((r, idx) => {
      initial[r.id] = { landing: idx === 0, departure: idx === 0 };
    });
    return initial;
  }, [state?.runwayConfig, airport]);

  return (
    <GamePage
      key={`${airport.id}-${difficulty}-${mode}-${goal}`}
      airport={airport}
      mode={mode}
      goal={goal}
      initialRunwayConfig={initialRunwayConfig}
      difficulty={difficulty}
      highScore={highScore}
      onExit={() => navigate('/')}
      onSave={onSave}
      onScoreUpdate={onScoreUpdate}
    />
  );
}

export default function App() {
  const [savedGames, setSavedGames] = useState<SavedGame[]>(loadSavedGames);

  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('atc_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const updateHighScore = (score: number) => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('atc_highscore', score.toString());
    }
  };

  const handleSaveGame = (saveData: Omit<SavedGame, 'id' | 'savedAt'>) => {
    const newSave: SavedGame = {
      ...saveData,
      id: Date.now().toString(36),
      savedAt: Date.now(),
    };
    const updated = [...savedGames, newSave];
    setSavedGames(updated);
    persistSavedGames(updated);
  };

  const handleDeleteGame = (id: string) => {
    const updated = savedGames.filter(g => g.id !== id);
    setSavedGames(updated);
    persistSavedGames(updated);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <HomePageWrapper
              savedGames={savedGames}
              highScore={highScore}
              onDeleteGame={handleDeleteGame}
            />
          }
        />
        <Route
          path="/game"
          element={
            <GamePageWrapper
              highScore={highScore}
              onSave={handleSaveGame}
              onScoreUpdate={updateHighScore}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
