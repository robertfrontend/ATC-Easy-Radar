import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Pause, Play, RotateCcw, Save, Home, Volume2, VolumeX,
  Layers, AlertOctagon, Terminal, CloudSun, Gauge, Settings,
  ChevronDown, Check, Compass, Radio, Wind
} from 'lucide-react';
import { useGameLoop, SessionMode, SHIFT_DURATION_MS } from '../hooks/useGameLoop';
import { DIFFICULTY_CONFIG } from '../utils/spawn';
import { createTutorialScenario, isTutorialHeadingCleared, isTutorialDescentCleared, isTutorialSpeedCleared, isTutorialSeparationCleared, hasTutorialSeparation } from '../utils/tutorial';
import { RadarDisplay, DEFAULT_SPAN } from './RadarDisplay';
import { createRadarDomain, RadarDomain } from '../utils/radarBounds';
import { ControlPanel } from './ControlPanel';
import { Airport, Difficulty, SavedGame, RadarLayers, RunwayConfig, GameSpeed } from '../types';
import { audioManager } from '../utils/audio';
import { parseAtcCommand } from '../utils/commands';
import { challengeRunways, getIntensity } from '../challenges/model';

export interface GamePageProps {
  airport: Airport;
  mode?: SessionMode;
  goal?: number;
  challengeLevel?: number;
  onChallengeComplete?: () => void;
  onNextChallenge?: () => void;
  initialRunwayConfig?: RunwayConfig;
  activeRunwayIndex?: number;
  difficulty: Difficulty;
  highScore: number;
  onExit: () => void;
  onSave: (save: Omit<SavedGame, 'id' | 'savedAt'>) => void;
  onScoreUpdate: (score: number) => void;
}

export const GamePage: React.FC<GamePageProps> = ({
  airport,
  mode = 'free' as SessionMode,
  goal: requestedGoal = 10,
  challengeLevel,
  onChallengeComplete,
  onNextChallenge,
  initialRunwayConfig,
  activeRunwayIndex,
  difficulty,
  highScore,
  onExit,
  onSave,
  onScoreUpdate
}) => {
  const intensity = mode === 'challenge' ? getIntensity(airport.id, challengeLevel ?? 1) : null;
  const goal = intensity?.minimumOperations ?? requestedGoal;
  const [tutorialPhase, setTutorialPhase] = useState<'arrival' | 'separation'>('arrival');
  const [tutorialStep, setTutorialStep] = useState('select');
  const separationSinceRef = useRef<number | null>(null);
  const tutorialScenario = useMemo(() => createTutorialScenario(airport, tutorialPhase), [airport, tutorialPhase]);
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [runwayConfig, setRunwayConfig] = useState<RunwayConfig>(() => {
    if (mode === 'challenge') return challengeRunways(airport);
    if (mode === 'tutorial') return tutorialScenario.runwayConfig;
    if (initialRunwayConfig && Object.keys(initialRunwayConfig).length > 0) {
      return initialRunwayConfig;
    }
    const initial: RunwayConfig = {};
    airport.runways.forEach((r, idx) => {
      const isSelected = idx === (activeRunwayIndex || 0);
      initial[r.id] = {
        landing: isSelected,
        departure: isSelected,
      };
    });
    return initial;
  });

  const activeRunwaysSummary = useMemo(() => {
    const landings = airport.runways.filter(r => runwayConfig[r.id]?.landing).map(r => r.label);
    const departures = airport.runways.filter(r => runwayConfig[r.id]?.departure).map(r => r.label);
    return {
      landings: landings.length > 0 ? landings.join(', ') : 'NONE',
      departures: departures.length > 0 ? departures.join(', ') : 'NONE',
      landingCount: landings.length,
      departureCount: departures.length,
    };
  }, [airport.runways, runwayConfig]);

  const toggleRunwayLanding = (runwayId: string) => {
    setRunwayConfig(prev => {
      const current = prev[runwayId] || { landing: false, departure: false };
      return {
        ...prev,
        [runwayId]: { ...current, landing: !current.landing }
      };
    });
  };

  const toggleRunwayDeparture = (runwayId: string) => {
    setRunwayConfig(prev => {
      const current = prev[runwayId] || { landing: false, departure: false };
      return {
        ...prev,
        [runwayId]: { ...current, departure: !current.departure }
      };
    });
  };

  const setRunwayPreset = (preset: 'single' | 'all-ils' | 'all-ops') => {
    setRunwayConfig(() => {
      const next: RunwayConfig = {};
      airport.runways.forEach((r, idx) => {
        if (preset === 'single') {
          const isDefault = idx === (activeRunwayIndex ?? 0);
          next[r.id] = { landing: isDefault, departure: isDefault };
        } else if (preset === 'all-ils') {
          next[r.id] = { landing: true, departure: idx === 0 };
        } else if (preset === 'all-ops') {
          next[r.id] = { landing: true, departure: true };
        }
      });
      return next;
    });
  };

  const [activeMenu, setActiveMenu] = useState<'runways' | 'settings' | null>(null);
  const [utcTime, setUtcTime] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Radar scope layer toggles
  const [layers, setLayers] = useState<RadarLayers>({
    showRangeRings: false,
    showFixes: true,
    showVectors: true,
    showTrails: true,
    showHalos: true,
    showExtendedCenterlines: true,
  });

  const [domain, setDomain] = useState<RadarDomain>();
  const captureViewport = useCallback((aspect: number) => {
    if (Number.isFinite(aspect) && aspect > 0) setDomain(previous => previous ?? createRadarDomain(aspect, DEFAULT_SPAN / 2));
  }, []);
  const randomMode = mode !== 'tutorial';
  const tutorialFrozen = mode === 'tutorial' && !['capture', 'landed', 'separation'].includes(tutorialStep);
  const { planes, score, accidents, session, events, elapsedMs, effectiveDifficulty, hasEnded, isPaused, togglePause, updatePlaneTarget, restart } = useGameLoop(
    airport, runwayConfig, difficulty, gameSpeed,
    { mode, goal, level: challengeLevel, domain: randomMode ? domain : undefined, initialPlanes: mode === 'tutorial' ? tutorialScenario.planes : undefined, blocked: activeMenu !== null || tutorialFrozen || (randomMode && !domain) }
  );
  useEffect(() => {
    if (mode === 'challenge' && session.status === 'completed') onChallengeComplete?.();
  }, [mode, session.status, onChallengeComplete]);
  const resetSession = () => {
    setSelectedId(null);
    setCommandInput('');
    setCommandFeedback('');
    setActiveMenu(null);
    separationSinceRef.current = null;
    transmitGuardRef.current = { text: '', at: 0 };
    if (mode === 'tutorial') {
      const scenario = createTutorialScenario(airport, 'arrival');
      setTutorialPhase('arrival');
      setTutorialStep('select');
      setRunwayConfig(scenario.runwayConfig);
      restart(scenario.planes);
    } else restart();
  };
  const startSeparationLesson = () => {
    const scenario = createTutorialScenario(airport, 'separation');
    setTutorialPhase('separation');
    setTutorialStep('separation-select');
    setRunwayConfig(scenario.runwayConfig);
    setSelectedId(null);
    setCommandInput('');
    setCommandFeedback('');
    separationSinceRef.current = null;
    transmitGuardRef.current = { text: '', at: 0 };
    restart(scenario.planes);
  };

  // Real-time UTC / Zulu Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      const s = d.getUTCSeconds().toString().padStart(2, '0');
      setUtcTime(`${h}:${m}:${s}Z`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close submenus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSubmenu = (menu: 'runways' | 'settings') => {
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  useEffect(() => {
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  const selectedPlane = planes.find(p => p.id === selectedId) || null;
  const tutorialPlane = planes.find(p => p.id === tutorialScenario.primaryPlaneId);
  useEffect(() => {
    if (mode !== 'tutorial' || hasEnded) return;
    if (tutorialStep === 'select' && selectedId === tutorialScenario.primaryPlaneId) setTutorialStep('heading');
    else if (tutorialStep === 'heading' && isTutorialHeadingCleared(tutorialPlane, tutorialScenario)) setTutorialStep('descent');
    else if (tutorialStep === 'descent' && isTutorialDescentCleared(tutorialPlane, tutorialScenario)) setTutorialStep('speed');
    else if (tutorialStep === 'speed' && isTutorialSpeedCleared(tutorialPlane, tutorialScenario)) setTutorialStep('capture');
    else if (tutorialStep === 'capture' && tutorialPlane?.isEstablished) setTutorialStep('landed');
    else if (['capture', 'landed'].includes(tutorialStep) && score >= 1) setTutorialStep('briefing');
    else if (tutorialStep === 'separation-select' && selectedId === tutorialScenario.primaryPlaneId) setTutorialStep('separation-clearance');
    else if (tutorialStep === 'separation-clearance' && isTutorialSeparationCleared(planes, tutorialScenario)) setTutorialStep('separation');
    else if (tutorialStep === 'separation') {
      if (hasTutorialSeparation(planes, tutorialScenario)) {
        if (separationSinceRef.current === null) separationSinceRef.current = elapsedMs;
        if (elapsedMs - separationSinceRef.current >= 3000) setTutorialStep('complete');
      } else separationSinceRef.current = null;
    }
  }, [mode, tutorialStep, tutorialPlane, tutorialScenario, selectedId, score, planes, elapsedMs, hasEnded]);

  // Check if any aircraft is currently in STCA conflict alert
  const hasActiveConflict = useMemo(() => {
    return planes.some(p => p.conflict || p.status === 'warning');
  }, [planes]);

  // Deselect if plane is removed
  useEffect(() => {
    if (selectedId && !planes.find(p => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [planes, selectedId]);

  const [commandInput, setCommandInput] = useState('');
  const [commandFeedback, setCommandFeedback] = useState('');
  const selectionRef = useRef({ id: null as string | null, plane: null as typeof selectedPlane });
  selectionRef.current = { id: selectedId, plane: selectedPlane };
  const airportRef = useRef(airport);
  airportRef.current = airport;
  const runwayConfigRef = useRef(runwayConfig);
  runwayConfigRef.current = runwayConfig;
  // Ignore a second transmit from keydown + submit in the same keypress.
  const transmitGuardRef = useRef({ text: '', at: 0 });

  // Keep the console focused when a track is selected.
  useEffect(() => {
    setCommandInput('');
    if (selectedId) {
      setCommandFeedback('');
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [selectedId]);

  const transmitCommand = (raw: string) => {
    const text = raw.trim();
    const { id, plane } = selectionRef.current;
    if (!id || !plane || !text) return;

    const now = Date.now();
    if (transmitGuardRef.current.text === text && now - transmitGuardRef.current.at < 400) return;
    transmitGuardRef.current = { text, at: now };

    const updates = parseAtcCommand(text, {
      airport: airportRef.current,
      runwayConfig: runwayConfigRef.current,
      plane,
    });
    if (updates) {
      setCommandFeedback(`${plane.callsign}: clearance transmitted.`);
      updatePlaneTarget(id, updates);
      try {
        audioManager.playRadio();
      } catch {
        // A sound failure must not discard the clearance or leave the text behind.
      }
    }
    else {
      setCommandFeedback('Command not recognized. Try H270, D3000, S180 or DEP.');
      return;
    }
    // Consume this selection synchronously, including duplicate submit events.
    // The disabled console hands keyboard focus back to aircraft selection.
    selectionRef.current = { id: null, plane: null };
    const focusRadar = () => {
      if (!selectionRef.current.id) radarRef.current?.focus({ preventScroll: true });
    };
    flushSync(() => {
      setCommandInput('');
      setSelectedId(null);
    });
    focusRadar();
    requestAnimationFrame(focusRadar);
  };

  const handleSaveGame = () => {
    onSave({
      score,
      accidents,
      difficulty,
      airportId: airport.id,
      planesActive: planes.length,
      gameSpeed,
      mode,
      ...(mode === 'shift' || mode === 'challenge' ? { points: session.points, goal } : {}),
      ...(mode === 'challenge' ? { challengeLevel } : {}),
    });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioManager.setMuted(newMuted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Own Enter here. Implicit form submit is easy for the browser to swallow
    // (autofill on a named field, or the input unmounting mid-key), and then
    // nothing is applied and the text stays.
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      transmitCommand(e.currentTarget.value);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const tokens = commandInput.trim().toUpperCase().split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      const rwyTargets = airport.runways.map(r => `ILS${r.label}`);
      const autoCompleteTargets = [...airport.waypoints.map(w => w.label), ...rwyTargets, 'FINAL', 'ILS', 'UPWIND', 'DEP'];

      if (lastToken) {
        const match = autoCompleteTargets.find(label => label.toUpperCase().startsWith(lastToken));
        if (match) {
          tokens[tokens.length - 1] = match.toUpperCase();
          setCommandInput(tokens.join(' ') + ' ');
        }
      }
    } else if (e.key === 'Escape') {
      setSelectedId(null);
      setActiveMenu(null);
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    transmitCommand(inputRef.current?.value ?? commandInput);
  };

  const selectedExit = selectedPlane?.exitWaypointId
    ? airport.waypoints.find(w => w.id === selectedPlane.exitWaypointId) || null
    : null;

  const primaryRunway = airport.runways[activeRunwayIndex ?? 0] || airport.runways[0];
  const tutorialHeading = tutorialScenario.targets.heading.toString().padStart(3, '0');
  const tutorialCallsign = tutorialScenario.planes.find(p => p.id === tutorialScenario.primaryPlaneId)?.callsign ?? 'TRAIN1';
  const tutorialMessages: Record<string, [string, string]> = {
    select: ['1 / SELECT ONE AIRCRAFT', `Click ${tutorialCallsign} on the radar. Time is stopped, so you can explore without pressure.`],
    heading: ['2 / TURN ONTO FINAL', `Send H${tutorialHeading} in the console, or choose Runway Heading and TRANSMIT CLEARANCE. A slider change alone is only a draft.`],
    descent: ['3 / DESCEND', `Select ${tutorialCallsign} again after a console transmission. Send D3000, or choose 3k and transmit. ILS capture requires actual altitude at or below 10,000 ft, not just a clearance.`],
    speed: ['4 / SLOW DOWN', `Select ${tutorialCallsign} again after a console transmission. Send S180, or choose 180kt and transmit. Then watch the turn and descent. The dotted forecast follows your active clearance.`],
    capture: ['5 / WATCH ILS CAPTURE', 'The simulation is running. The aircraft must reach the cone, turn within 50° of the runway and descend below 10,000 ft. Select it to see the capture checklist.'],
    landed: ['6 / FIRST LANDING', 'ILS captured! Automatic guidance handles the final descent and landing. Watch the operation counter.'],
    briefing: ['FIRST ARRIVAL COMPLETE', 'Next: two converging aircraft. You will create vertical spacing before they meet.'],
    'separation-select': ['7 / SELECT THE CROSSING TRAFFIC', `Click ${tutorialCallsign}. Both aircraft are at 4,000 ft. We have stopped time so you can plan.`],
    'separation-clearance': ['8 / CREATE VERTICAL SPACING', 'Send C5000 to the selected aircraft (or choose 5k and transmit). Its partner stays at 4,000 ft.'],
    separation: ['9 / WATCH THE CLIMB', 'A cleared altitude is not the same as separation. Wait until the aircraft is actually 1,000 ft above its partner and holds that spacing.'],
    complete: ['TRAINING COMPLETE', 'You guided an arrival and created safe spacing. Choose a five-minute shift to put both skills together.'],
  };
  const tutorialCopy = tutorialMessages[tutorialStep];
  const remainingSeconds = Math.max(0, Math.ceil((SHIFT_DURATION_MS - elapsedMs) / 1000));
  const debriefEvent = [...events].reverse().find(event => event.kind === 'accident') ?? [...events].reverse().find(event => event.kind === 'warning' || event.kind === 'missed');

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:min-h-[540px] bg-scope text-ink font-mono overflow-x-hidden md:overflow-hidden select-none">
      {/* Main Radar Area */}
      <div className="md:flex-1 min-w-0 min-h-0 flex flex-col relative">
        {/* Sleek, Minimalist, Ultra-Clean ATC Top Bar */}
        <header ref={headerRef} className="min-h-10 bg-header border-b border-line px-4 py-2 flex flex-wrap gap-x-4 gap-y-2 justify-between items-center z-30 select-none text-xs">
          {/* Left: Clean Station Identifier */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-ink-bright tracking-widest text-sm">{airport.icao} APP</span>
            <span className="text-ink-faint">|</span>
            <span className="text-ink font-semibold">RWY {activeRunwaysSummary.landings}</span>
            <span className="text-ink-faint">|</span>
            <span className="text-ink-dim">{planes.length} TRACKS</span>
            {gameSpeed === 'real' && (
              <>
                <span className="text-ink-faint">|</span>
                <span className="bg-inset text-phosphor border border-line px-2 py-0.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-phosphor"></span>
                  VELOCIDAD REAL (1:1)
                </span>
              </>
            )}
          </div>

          {/* Center: Monospace Zulu Clock & Stats */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-ink-bright font-bold tracking-wider">{utcTime || '00:00:00Z'}</span>
            <span className="text-ink-faint">·</span>
            <span className="text-phosphor font-semibold">OPS: {score}</span>
            <span className="text-ink-faint">·</span>
            <span className={accidents > 0 ? 'text-conflict font-bold animate-pulse' : 'text-ink-faint'}>
              ACCD: {accidents}
            </span>
            {isPaused && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="bg-alert-soft text-alert border border-alert px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider animate-pulse">
                  PAUSED
                </span>
              </>
            )}
          </div>

          {/* Right: Only 2 Minimalist Dropdown Action Buttons */}
          <div className="flex items-center gap-2">
            {/* 1. RUNWAYS BUTTON & DROPDOWN */}
            <div className="relative">
              <button
                disabled={mode === 'tutorial' || mode === 'challenge'}
                onClick={() => toggleSubmenu('runways')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                  activeMenu === 'runways'
                    ? 'bg-ink-bright border-ink-bright text-scope'
                    : 'bg-inset border-line text-ink hover:border-line-strong hover:text-ink-bright'
                }`}
                title="Configure Active Runways & ILS"
              >
                <span>RWYS ({activeRunwaysSummary.landingCount})</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {activeMenu === 'runways' && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-panel border border-line-strong rounded-lg shadow-2xl p-3 z-50 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-line">
                    <span className="font-bold text-phosphor uppercase tracking-wider text-[11px]">ACTIVE RUNWAYS & ILS</span>
                    <span className="text-[10px] text-ink-faint font-bold">{airport.icao}</span>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setRunwayPreset('all-ils')}
                      className="flex-1 py-1 rounded bg-inset hover:bg-panel-raised border border-line text-[10px] font-bold text-ink hover:text-ink-bright transition-colors"
                    >
                      ALL ILS
                    </button>
                    <button
                      onClick={() => setRunwayPreset('all-ops')}
                      className="flex-1 py-1 rounded bg-inset hover:bg-panel-raised border border-line text-[10px] font-bold text-ink hover:text-ink-bright transition-colors"
                    >
                      FULL OPS
                    </button>
                    <button
                      onClick={() => setRunwayPreset('single')}
                      className="flex-1 py-1 rounded bg-inset hover:bg-panel-raised border border-line text-[10px] font-bold text-ink-dim hover:text-ink-bright transition-colors"
                    >
                      SINGLE
                    </button>
                  </div>

                  {/* Runways Toggle List */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {airport.runways.map(rwy => {
                      const isLanding = !!runwayConfig[rwy.id]?.landing;
                      const isDep = !!runwayConfig[rwy.id]?.departure;
                      return (
                        <div
                          key={rwy.id}
                          className="bg-inset border border-line rounded p-2 flex items-center justify-between"
                        >
                          <div className="font-bold text-ink-bright text-xs">
                            RWY {rwy.label} <span className="text-[10px] text-ink-faint font-normal">({rwy.heading}°)</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleRunwayLanding(rwy.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                isLanding
                                  ? 'bg-ink-bright text-scope border-ink-bright'
                                  : 'bg-scope border-line text-ink-faint hover:text-ink'
                              }`}
                            >
                              ILS
                            </button>
                            <button
                              onClick={() => toggleRunwayDeparture(rwy.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                isDep
                                  ? 'bg-ink-bright text-scope border-ink-bright'
                                  : 'bg-scope border-line text-ink-faint hover:text-ink'
                              }`}
                            >
                              DEP
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. UNIFIED SETTINGS / ATC MENU */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu('settings')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                  activeMenu === 'settings'
                    ? 'bg-ink-bright border-ink-bright text-scope'
                    : 'bg-inset border-line text-ink hover:border-line-strong hover:text-ink-bright'
                }`}
                title="Simulation Controls, Overlays & Settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>MENU</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {activeMenu === 'settings' && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-panel border border-line-strong rounded-lg shadow-2xl p-3.5 z-50 space-y-3 text-xs">
                  {/* Simulation Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-ink-dim font-bold uppercase tracking-wider">Velocidad / Speed:</div>
                      {gameSpeed === 'real' && (
                        <span className="text-[9px] text-phosphor font-bold bg-inset px-1.5 py-0.5 rounded border border-line">
                          1:1 REAL TIME
                        </span>
                      )}
                    </div>

                    {/* Dedicated Real Speed Button */}
                    <button
                      disabled={mode === 'challenge'}
                      onClick={() => setGameSpeed('real')}
                      className={`w-full py-1.5 px-2.5 rounded font-bold text-xs border transition-all flex items-center justify-center gap-1.5 ${
                        gameSpeed === 'real'
                          ? 'bg-ink-bright text-scope border-ink-bright'
                          : 'bg-inset border-line text-ink hover:border-line-strong hover:text-ink-bright'
                      }`}
                      title="Simulación en tiempo real (1:1 ATC scale, giros 3°/s)"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      <span>VELOCIDAD REAL</span>
                      {gameSpeed === 'real' && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </button>

                    {/* Multiplier Speeds */}
                    <div className="grid grid-cols-4 gap-1">
                      {([0.5, 1, 2, 4] as const).map(spd => (
                        <button
                          key={spd}
                          disabled={mode === 'challenge'}
                          onClick={() => setGameSpeed(spd)}
                          className={`py-1 rounded text-center font-bold border text-xs transition-colors ${
                            gameSpeed === spd
                              ? 'bg-ink-bright text-scope border-ink-bright'
                              : 'bg-inset border-line text-ink hover:bg-panel-raised hover:text-ink-bright'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>

                    {gameSpeed === 'real' && (
                      <div className="text-[9.5px] text-ink-dim bg-inset border border-line rounded p-1.5 leading-tight font-mono">
                        Escala física 1:1, viraje estándar a 3°/s y velocidades reales en nudos (KTS).
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={togglePause}
                        className={`py-1.5 px-2 rounded border font-bold flex items-center justify-center gap-1.5 text-xs transition-colors ${
                          isPaused
                            ? 'bg-alert-soft border-alert text-alert'
                            : 'bg-inset border-line text-ink hover:bg-panel-raised hover:text-ink-bright'
                        }`}
                      >
                        {isPaused ? <Play className="w-3 h-3 text-alert" /> : <Pause className="w-3 h-3" />}
                        <span>{isPaused ? 'Resume' : 'Pause'}</span>
                      </button>

                      <button
                        onClick={toggleMute}
                        className={`py-1.5 px-2 rounded border font-bold flex items-center justify-center gap-1.5 text-xs transition-colors ${
                          isMuted
                            ? 'bg-alert-soft border-alert text-alert'
                            : 'bg-inset border-line text-ink hover:bg-panel-raised hover:text-ink-bright'
                        }`}
                      >
                        {isMuted ? <VolumeX className="w-3 h-3 text-alert" /> : <Volume2 className="w-3 h-3 text-phosphor" />}
                        <span>{isMuted ? 'Muted' : 'Audio ON'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Overlays / Radar Layers */}
                  <div className="pt-2 border-t border-line space-y-1.5">
                    <div className="text-[10px] text-ink-dim font-bold uppercase tracking-wider">Radar Overlays:</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer text-ink hover:text-ink-bright">
                        <input
                          type="checkbox"
                          checked={layers.showRangeRings}
                          onChange={e => setLayers(l => ({ ...l, showRangeRings: e.target.checked }))}
                        />
                        <span>Range Rings</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-ink hover:text-ink-bright">
                        <input
                          type="checkbox"
                          checked={layers.showFixes}
                          onChange={e => setLayers(l => ({ ...l, showFixes: e.target.checked }))}
                        />
                        <span>Fixes (◎)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-ink hover:text-ink-bright">
                        <input
                          type="checkbox"
                          checked={layers.showVectors}
                          onChange={e => setLayers(l => ({ ...l, showVectors: e.target.checked }))}
                        />
                        <span>Vectors</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-ink hover:text-ink-bright">
                        <input
                          type="checkbox"
                          checked={layers.showHalos}
                          onChange={e => setLayers(l => ({ ...l, showHalos: e.target.checked }))}
                        />
                        <span>3 NM Halos</span>
                      </label>
                    </div>
                  </div>

                  {/* Weather Info */}
                  <div className="pt-2 border-t border-line text-[11px] text-ink-dim space-y-0.5">
                    <div className="text-[10px] text-ink-faint font-bold uppercase">METAR / ATIS:</div>
                    <div className="text-ink">WIND: {primaryRunway.heading}° / 10KT · QNH: 1013 (29.92)</div>
                  </div>

                  {/* System Actions */}
                  <div className="pt-2 border-t border-line flex items-center gap-1.5">
                    <button
                      onClick={() => { handleSaveGame(); setActiveMenu(null); }}
                      className="flex-1 py-1.5 rounded bg-inset hover:bg-panel-raised border border-line text-ink font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      <span>{saveFlash ? 'Saved!' : 'Save'}</span>
                    </button>
                    <button
                      onClick={resetSession}
                      className="flex-1 py-1.5 rounded bg-inset hover:bg-panel-raised border border-line text-alert font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restart</span>
                    </button>
                    <button
                      onClick={onExit}
                      className="flex-1 py-1.5 rounded bg-inset hover:bg-panel-raised border border-line text-ink font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <Home className="w-3 h-3" />
                      <span>Exit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="bg-panel border-b border-line px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <strong className="text-phosphor">{mode === 'challenge' ? `RETO · NIVEL ${challengeLevel}/20` : mode === 'tutorial' ? 'GUIDED TRAINING' : mode === 'shift' ? 'FIVE-MINUTE SHIFT' : 'FREE PLAY'}</strong>
            {mode === 'challenge' && <><span>{session.operations}/{goal} operaciones efectivas · cero accidentes</span><span>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')} de turno restante · 1× fijo</span></>}
            {mode === 'shift' && <><span>{score}/{goal} safe operations</span><span>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')} left</span><span>{session.points} pts · streak {session.streak}</span><span>Traffic: {effectiveDifficulty.toUpperCase()}</span></>}
          </div>
          <button onClick={togglePause} disabled={hasEnded || tutorialFrozen} className="border border-line-strong px-3 py-1 rounded text-ink-bright disabled:opacity-40">{isPaused ? 'Resume' : 'Pause'}</button>
        </div>
        {mode === 'tutorial' && tutorialCopy && (
          <section aria-label="Tutorial instruction" className="bg-inset border-b border-phosphor px-4 py-3 text-xs space-y-2">
            <strong className="text-phosphor block">{tutorialCopy[0]}</strong>
            <p className="text-ink leading-relaxed max-w-3xl">{tutorialCopy[1]}</p>
            {tutorialStep === 'briefing' && <button onClick={startSeparationLesson} className="rounded bg-phosphor text-scope px-3 py-2 font-bold">START SEPARATION LESSON</button>}
            {tutorialStep === 'complete' && <button onClick={onExit} className="rounded bg-phosphor text-scope px-3 py-2 font-bold">CHOOSE A SHIFT</button>}
            <button onClick={resetSession} className="text-ink-dim underline mr-4">Restart training</button>
            <button onClick={onExit} className="text-ink-dim underline">Back to sessions</button>
          </section>
        )}

        {/* STCA Conflict Warning Bar (Flashing alert banner) */}
        {hasActiveConflict && (
          <div className="bg-conflict-banner border-b border-conflict text-conflict px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 animate-pulse z-20">
            <AlertOctagon className="w-4 h-4 text-conflict" />
            <span>CA ALARM: LOSS OF SEPARATION (LESS THAN 55 RADAR UNITS / 1000 FT) DETECTED</span>
          </div>
        )}

        {/* Main Radar Scope Container */}
        <div className="md:flex-1 min-h-0 w-full relative flex flex-col bg-scope">
          <div ref={radarRef} role="region" aria-label="Radar aircraft selection" tabIndex={-1} className="w-full md:flex-1 min-h-0 relative bg-scope overflow-hidden">
            <RadarDisplay
              domain={randomMode ? domain : undefined}
              onViewportAspect={captureViewport}
              airport={airport}
              runwayConfig={runwayConfig}
              planes={planes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCommand={updatePlaneTarget}
              layers={layers}
              gameSpeed={gameSpeed}
              ilsWidth={DIFFICULTY_CONFIG[effectiveDifficulty].ilsWidth}
            />

          </div>
          {/* Reserved footer keeps all radar corners clear at every screen size. */}
          <div className="relative shrink-0 mx-auto my-3 z-30 w-full max-w-lg px-4 pointer-events-auto">
            <form onSubmit={handleCommandSubmit} autoComplete="off" className="relative">
              <div className="relative flex flex-col bg-panel border border-line-strong rounded-lg p-2.5 shadow-2xl">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-phosphor" />
                  <span className="text-phosphor font-bold text-sm tracking-wider">
                    {selectedPlane ? selectedPlane.callsign : 'ATC'}&gt;
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    placeholder={
                      !selectedPlane
                        ? "CLICK AIRCRAFT TO COMMAND..."
                        : selectedPlane.type === 'departure' && selectedExit && selectedPlane.targetWaypoint !== selectedExit.id
                          ? `DEP → ${selectedExit.label}, H090, C11000, S240`
                          : "e.g. ILS 33L, D3000 H090 S210, HARBR..."
                    }
                    disabled={!selectedId}
                    className="bg-transparent border-none outline-none flex-1 min-w-0 text-ink-bright placeholder:text-ink-faint uppercase tracking-widest text-sm disabled:cursor-not-allowed"
                  />
                  {commandInput && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => transmitCommand(inputRef.current?.value ?? commandInput)}
                      className="bg-inset hover:bg-panel-raised text-phosphor hover:text-ink-bright text-[10px] font-bold px-2 py-1 rounded border border-line-strong uppercase tracking-wider"
                    >
                      ENTER: TX
                    </button>
                  )}
                </div>

                {/* Micro Syntax Cheat-Sheet */}
                <div className="mt-1 pt-1 border-t border-line flex flex-wrap gap-x-2 items-center justify-between text-[10px] text-ink-faint font-mono">
                  <span>DEP (exit) · ILS {primaryRunway.label} · D3000 · H{primaryRunway.heading.toString().padStart(3, '0')} · S180</span>
                  <span>[TAB] Auto-Complete</span>
                </div>
                {commandFeedback && <p role="status" className="text-[11px] text-phosphor mt-1">{commandFeedback}</p>}
              </div>
            </form>
          </div>
        </div>

        {hasEnded && (
          <div role="dialog" aria-modal="true" aria-labelledby="debrief-title" className="fixed inset-0 bg-scrim backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <section className="bg-panel border border-line-strong rounded-xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
              <p className="text-xs text-phosphor tracking-widest">SESSION DEBRIEF</p>
              <h2 id="debrief-title" className="text-2xl font-bold text-ink-bright">{mode === 'challenge' ? session.status === 'completed' ? 'Nivel superado' : 'Nivel no superado' : session.status === 'failed' ? 'Let’s learn from this one' : session.status === 'completed' ? 'Objective complete' : 'Shift complete'}</h2>
              <p className="text-sm text-ink">{mode === 'challenge' ? `${session.operations}/${goal} operaciones efectivas · ${Math.floor(elapsedMs / 1000)}/300 s activos · ${accidents} accidentes` : `${score}/${goal} safe operations · ${session.points} points · best streak ${session.bestStreak}`}</p>
              {mode === 'challenge' && <p>{session.status === 'completed' ? 'Resultado aprobado. Tu progreso local se conserva; puedes repetir este nivel.' : 'No se desbloquea otro nivel. Completa el turno sin accidentes y con el mínimo de operaciones de aeronaves a las que hayas transmitido una orden.'}</p>}
              <p className="text-xs text-ink-dim">{session.warningEpisodes} separation-alert episodes · {session.missedExits} missed operations · {accidents} accident{accidents === 1 ? '' : 's'}</p>
              {debriefEvent ? <div className="bg-inset border border-line rounded p-3 text-sm space-y-2"><p className="text-alert">{debriefEvent.message}</p><p>{debriefEvent.advice}</p></div> : mode !== 'challenge' && <p className="text-sm">{score >= goal ? 'Safe sequencing paid off. Try another airport or a higher traffic ceiling.' : 'Build a sequence early: descend arrivals toward the ILS and clear departures to their exit fix.'}</p>}
              <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-ink-dim" aria-label="Recent flight events">
                {events.slice(-5).map(event => <p key={event.id}>{Math.floor(event.at / 1000)}s · {event.message}</p>)}
              </div>
              <p className="text-[11px] text-ink-faint">{mode === 'challenge' ? 'Para aprobar cuentan únicamente el turno completo, cero accidentes y el mínimo de operaciones efectivas. Puntos y alertas no añaden requisitos ocultos.' : 'Scoring: +100 per operation plus clean-streak bonus; −25 per alert episode; −50 for a missed operation. An accident ends the shift.'}</p>
              <div className="flex flex-wrap gap-3"><button onClick={handleSaveGame} disabled={saveFlash} className="rounded border border-line-strong px-4 py-2">{saveFlash ? 'SAVED' : 'SAVE RESULT'}</button><button autoFocus onClick={resetSession} className="rounded bg-phosphor text-scope px-4 py-2 font-bold">{mode === 'challenge' ? 'Repetir nivel' : 'TRY AGAIN'}</button><button onClick={onExit} className="rounded border border-line-strong px-4 py-2">{mode === 'challenge' ? 'Elegir nivel' : 'CHOOSE SESSION'}</button>{mode === 'challenge' && session.status === 'completed' && onNextChallenge && <button onClick={onNextChallenge} className="rounded border border-phosphor px-4 py-2">Siguiente nivel</button>}</div>
            </section>
          </div>
        )}

        {/* Paused Overlay (shown when paused and no dropdown menu is open) */}
        {isPaused && !activeMenu && !hasEnded && (
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="text-5xl font-bold text-ink-bright tracking-[0.3em] mb-6">
              SIMULATION PAUSED
            </div>
            <button
              onClick={togglePause}
              className="px-8 py-3.5 bg-alert text-scope font-bold text-lg rounded border border-alert hover:opacity-90 transition-opacity"
            >
              RESUME RADAR
            </button>
          </div>
        )}
      </div>

      {/* Side ATC Flight Strip Pedestal */}
      <div className="w-full md:w-80 xl:w-96 shrink-0 bg-panel border-t md:border-t-0 md:border-l border-line p-5 flex flex-col z-20 md:overflow-y-auto">
        <ControlPanel
          airport={airport}
          runwayConfig={runwayConfig}
          plane={selectedPlane}
          onCommand={updatePlaneTarget}
          onDeselect={() => setSelectedId(null)}
          ilsWidth={DIFFICULTY_CONFIG[effectiveDifficulty].ilsWidth}
        />
      </div>
    </div>
  );
};



