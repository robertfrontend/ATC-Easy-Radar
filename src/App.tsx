import { useState, useEffect } from 'react';
import { HomePage } from './components/HomePage';
import { GamePage } from './components/GamePage';
import { SavedGame, Airport, Difficulty } from './types';
import { AIRPORTS } from './config/airports';

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

export default function App() {
  const [page, setPage] = useState<'home' | 'game'>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [airport, setAirport] = useState<Airport>(AIRPORTS[0]);
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

  const handleNewGame = (diff: Difficulty, selectedAirportId: string) => {
    const selectedAirport = AIRPORTS.find(a => a.id === selectedAirportId) || AIRPORTS[0];
    setAirport(selectedAirport);
    setDifficulty(diff);
    setPage('game');
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

  if (page === 'home') {
    return (
      <HomePage
        savedGames={savedGames}
        onNewGame={handleNewGame}
        onDeleteGame={handleDeleteGame}
        highScore={highScore}
      />
    );
  }

  return (
    <GamePage
      airport={airport}
      difficulty={difficulty}
      highScore={highScore}
      onExit={() => setPage('home')}
      onSave={handleSaveGame}
      onScoreUpdate={updateHighScore}
    />
  );
}
