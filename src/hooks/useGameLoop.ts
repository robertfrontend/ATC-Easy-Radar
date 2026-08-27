import { useState, useEffect, useRef, useCallback } from 'react';
import { Plane, Difficulty, Airport, Runway, RunwayConfig } from '../types';
import { audioManager } from '../utils/audio';

export type { Plane, Difficulty };

const TICK_RATE = 50; // ms

const DIFFICULTY_CONFIG = {
  easy:   { maxPlanes: 4,  minPlanes: 2, spawnRate: 20000, ilsWidth: 0.4 },
  medium: { maxPlanes: 8,  minPlanes: 4, spawnRate: 15000, ilsWidth: 0.2 },
  hard:   { maxPlanes: 12, minPlanes: 6, spawnRate: 8000,  ilsWidth: 0.12 }
};

const generateCallsignAndDetails = (airport: Airport) => {
  const totalWeight = airport.airlines.reduce((sum, a) => sum + a.weight, 0);
  let randomVal = Math.random() * totalWeight;
  let selectedAirline = airport.airlines[0];
  
  for (const airline of airport.airlines) {
    randomVal -= airline.weight;
    if (randomVal <= 0) {
      selectedAirline = airline;
      break;
    }
  }

  const num = Math.floor(Math.random() * 9000) + 1000;
  const models = selectedAirline.models && selectedAirline.models.length > 0 ? selectedAirline.models : ['A320', 'B738'];
  const model = models[Math.floor(Math.random() * models.length)];
  
  const squawkDigit = () => Math.floor(Math.random() * 7) + 1;
  const squawk = `${squawkDigit()}${Math.floor(Math.random() * 8)}${Math.floor(Math.random() * 8)}${Math.floor(Math.random() * 8)}`;

  return {
    callsign: `${selectedAirline.code}${num}`,
    flag: selectedAirline.flag,
    model,
    squawk
  };
};

export const useGameLoop = (
  airport: Airport,
  runwayConfig: RunwayConfig,
  difficulty: Difficulty,
  gameSpeed: number = 1
) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [score, setScore] = useState(0);
  const [accidents, setAccidents] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const lastSpawnRef = useRef(0);
  const initializedRef = useRef(false);
  const planesRef = useRef<Plane[]>([]);
  const runwayConfigRef = useRef<RunwayConfig>(runwayConfig);
  const lastDepartureTimeRef = useRef<Record<string, number>>({});
  const globalLastDepartureRef = useRef<number>(0);

  useEffect(() => {
    runwayConfigRef.current = runwayConfig;
  }, [runwayConfig]);

  useEffect(() => {
    planesRef.current = planes;
  }, [planes]);

  // Real-world aviation departure clearance & separation check
  const isRunwaySafeForDeparture = useCallback((rwy: Runway, allPlanes: Plane[], now: number, spd: number) => {
    // 1. Is this runway configured for departure?
    if (!runwayConfigRef.current[rwy.id]?.departure) return false;

    // 2. Minimum Time Separation between takeoffs (Wake Turbulence Spacing: min 20s per runway, 10s global)
    const lastRwyDep = lastDepartureTimeRef.current[rwy.id] || 0;
    const timeSinceLastRwy = now - lastRwyDep;
    const minRwyInterval = 20000 / spd;
    if (timeSinceLastRwy < minRwyInterval) return false;

    const timeSinceGlobal = now - globalLastDepartureRef.current;
    const minGlobalInterval = 10000 / spd;
    if (timeSinceGlobal < minGlobalInterval) return false;

    const rwyX = airport.x + (rwy.offsetX || 0);
    const rwyY = airport.y + (rwy.offsetY || 0);

    for (const p of allPlanes) {
      if (p.status === 'crashed' || p.markedForRemoval) continue;

      const distToRwy = Math.hypot(p.x - rwyX, p.y - rwyY);

      // 3. Preceding Departure Separation (Downfield distance > 4.5 NM / 100 units & Altitude > 2,000 ft)
      if (p.type === 'departure' && p.assignedRunwayId === rwy.id) {
        if (distToRwy < 110 || p.altitude < 2000) {
          return false; // Preceding departure still in initial takeoff corridor!
        }
      }

      // 4. Runway Occupancy Protection (No aircraft on ground or rolling within threshold zone)
      if (distToRwy < 75 && p.altitude < 1200) {
        return false; // Runway is occupied
      }

      // 5. Inbound Arrival Separation (Incursion Protection against short final traffic)
      if (p.type === 'arrival') {
        const isApproachingThisRwy = p.establishedRunwayId === rwy.id || (p.assignedRunwayId === rwy.id && p.isEstablished);
        if (isApproachingThisRwy) {
          if (distToRwy < 125 || p.altitude < 2800) {
            return false; // Landing aircraft is on short final!
          }
        }
      }
    }

    return true;
  }, [airport]);

  const spawnPlane = useCallback(() => {
    const now = Date.now();
    const allPlanes = planesRef.current;

    // Find all runways eligible for safe departure right now
    const safeDepartureRunways = airport.runways.filter(r => 
      isRunwaySafeForDeparture(r, allPlanes, now, gameSpeed)
    );

    // Only allow departure if at least one runway is 100% clear and legal
    const isDeparture = safeDepartureRunways.length > 0 && (allPlanes.length === 0 ? true : Math.random() < 0.35);
    const { callsign, flag, model, squawk } = generateCallsignAndDetails(airport);
    
    let x, y, heading, targetHeading, altitude, targetAltitude, speed, targetSpeed, targetWaypoint = null;
    let assignedRunwayId: string | null = null;

    if (isDeparture) {
      const activeDepRunway = safeDepartureRunways[Math.floor(Math.random() * safeDepartureRunways.length)];
      lastDepartureTimeRef.current[activeDepRunway.id] = now;
      globalLastDepartureRef.current = now;

      const rwyX = airport.x + (activeDepRunway.offsetX || 0);
      const rwyY = airport.y + (activeDepRunway.offsetY || 0);
      x = rwyX;
      y = rwyY;
      
      const departureHeading = activeDepRunway.heading;
      
      const waypointsWithScore = airport.waypoints.map(wp => {
        const angleToWp = (Math.atan2(wp.y - rwyY, wp.x - rwyX) * 180 / Math.PI) + 90;
        const normalizedAngle = (angleToWp + 360) % 360;
        let diff = Math.abs(normalizedAngle - departureHeading);
        if (diff > 180) diff = 360 - diff;
        return { wp, diff };
      });
      
      waypointsWithScore.sort((a, b) => a.diff - b.diff);
      const bestWaypoints = waypointsWithScore.slice(0, 2);
      const selectedWp = bestWaypoints.length > 0
        ? bestWaypoints[Math.floor(Math.random() * bestWaypoints.length)].wp
        : airport.waypoints[0];
      
      targetWaypoint = selectedWp?.id || null;
      heading = departureHeading;
      targetHeading = heading;
      assignedRunwayId = activeDepRunway.id;

      altitude = 0;
      targetAltitude = 11000 + Math.floor(Math.random() * 6) * 1000;
      speed = 135;
      targetSpeed = 240;
    } else {
      // Arrivals spawn at perimeter
      const angle = Math.random() * Math.PI * 2;
      const distance = 580;
      x = airport.x + Math.cos(angle) * distance;
      y = airport.y + Math.sin(angle) * distance;
      
      const angleToCenter = Math.atan2(airport.y - y, airport.x - x);
      heading = (angleToCenter * 180 / Math.PI) + 90;
      if (heading < 0) heading += 360;
      heading = (heading + (Math.random() * 60 - 30)) % 360;
      targetHeading = heading;

      altitude = 10000 + Math.floor(Math.random() * 16) * 1000;
      targetAltitude = altitude;
      speed = 240 + Math.floor(Math.random() * 8) * 10;
      targetSpeed = speed;
    }

    const newPlane: Plane = {
      id: Math.random().toString(36).substring(7),
      callsign,
      model,
      squawk,
      type: isDeparture ? 'departure' : 'arrival',
      originFlag: flag,
      x,
      y,
      heading,
      targetHeading,
      altitude,
      targetAltitude,
      speed,
      targetSpeed,
      trail: [],
      status: 'normal',
      isEstablished: false,
      establishedRunwayId: null,
      assignedRunwayId,
      hasInstructions: isDeparture,
      targetWaypoint,
      conflict: false
    };
    
    setPlanes(prev => [...prev, newPlane]);
    audioManager.playBlip();
  }, [airport, isRunwaySafeForDeparture, gameSpeed]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      if (!initializedRef.current) {
        spawnPlane();
        initializedRef.current = true;
        lastSpawnRef.current = now;
      }

      const currentCount = planesRef.current.length;
      const timeSinceLast = now - lastSpawnRef.current;
      const minSpawnInterval = 4000 / gameSpeed;
      
      if (timeSinceLast > minSpawnInterval && (currentCount < config.minPlanes || (currentCount < config.maxPlanes && timeSinceLast > config.spawnRate / gameSpeed))) {
        spawnPlane();
        lastSpawnRef.current = now;
      }

      setPlanes(prevPlanes => {
        let hadConflictSound = false;
        const currentRwyConfig = runwayConfigRef.current;

        let nextPlanes = prevPlanes.map(plane => {
          let currentTargetHeading = plane.targetHeading;
          let currentTargetAltitude = plane.targetAltitude;
          let currentTargetSpeed = plane.targetSpeed;
          let isEstablished = plane.isEstablished;
          let establishedRunwayId = plane.establishedRunwayId;
          let currentTargetWaypoint = plane.targetWaypoint;

          // 1. Departure Initial Climb Corridor & Waypoint Guidance
          let markedForRemoval = plane.markedForRemoval;

          // For departures: maintain straight runway heading during initial climb (< 2,500 ft)
          if (plane.type === 'departure' && plane.altitude < 2500 && plane.assignedRunwayId) {
            const depRwy = airport.runways.find(r => r.id === plane.assignedRunwayId);
            if (depRwy) {
              currentTargetHeading = depRwy.heading;
            }
          } else if (currentTargetWaypoint && !isEstablished && plane.status !== 'crashed') {
            const wp = airport.waypoints.find(w => w.id === currentTargetWaypoint);
            if (wp) {
              const distToWp = Math.hypot(wp.x - plane.x, wp.y - plane.y);
              if (distToWp < 35) {
                if (plane.type === 'departure') {
                  markedForRemoval = true;
                } else {
                  currentTargetWaypoint = null;
                }
              } else {
                let headingToWp = (Math.atan2(wp.y - plane.y, wp.x - plane.x) * 180 / Math.PI) + 90;
                headingToWp = (headingToWp + 360) % 360;
                let angleDiff = headingToWp - plane.targetHeading;
                while (angleDiff <= -180) angleDiff += 360;
                while (angleDiff > 180) angleDiff -= 360;
                if (Math.abs(angleDiff) > 1.0) currentTargetHeading = headingToWp;
              }
            }
          }

          // 2. Multi-Runway ILS Capture Logic
          if (!isEstablished && !plane.goAround && plane.status !== 'crashed' && plane.type === 'arrival') {
            // Check candidate runways (assigned one, or all runways with ILS active)
            const candidateRunways = airport.runways.filter(r => {
              if (plane.assignedRunwayId) return r.id === plane.assignedRunwayId && currentRwyConfig[r.id]?.landing;
              return currentRwyConfig[r.id]?.landing;
            });

            for (const rwy of candidateRunways) {
              const rwyX = airport.x + (rwy.offsetX || 0);
              const rwyY = airport.y + (rwy.offsetY || 0);
              const dx = plane.x - rwyX;
              const dy = plane.y - rwyY;
              const rad = -rwy.heading * Math.PI / 180;
              const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
              const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);

              const inILSCone = rotatedY > 20 && rotatedY < 520 && Math.abs(rotatedX) <= rotatedY * config.ilsWidth;
              let relHeading = (plane.heading - rwy.heading + 360) % 360;
              const isHeadingAligned = relHeading > 310 || relHeading < 50;

              if (inILSCone && plane.altitude <= 10000 && isHeadingAligned) {
                isEstablished = true;
                establishedRunwayId = rwy.id;
                audioManager.playIlsCapture();
                break;
              }
            }
          }

          // 3. Established ILS Guidance for specific runway
          if (isEstablished && plane.status !== 'crashed') {
            const rwy = airport.runways.find(r => r.id === establishedRunwayId) || airport.runways[0];
            const rwyX = airport.x + (rwy.offsetX || 0);
            const rwyY = airport.y + (rwy.offsetY || 0);
            const dx = plane.x - rwyX;
            const dy = plane.y - rwyY;
            const rad = -rwy.heading * Math.PI / 180;
            const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
            let correction = rotatedX < 0 ? Math.min(30, -rotatedX * 2) : -Math.min(30, rotatedX * 2);
            currentTargetHeading = (rwy.heading + correction + 360) % 360;
            currentTargetAltitude = 0;
            currentTargetSpeed = 140;
          }

          // 4. Movement Physics
          let newHeading = plane.heading;
          if (plane.heading !== currentTargetHeading) {
            let diff = currentTargetHeading - plane.heading;
            while (diff <= -180) diff += 360;
            while (diff > 180) diff -= 360;
            const turnRate = 0.6;
            if (Math.abs(diff) < turnRate) newHeading = currentTargetHeading;
            else newHeading = (plane.heading + Math.sign(diff) * turnRate + 360) % 360;
          }

          let newAltitude = plane.altitude;
          if (plane.altitude !== currentTargetAltitude) {
            const altDiff = currentTargetAltitude - plane.altitude;
            const climbRate = 18;
            if (Math.abs(altDiff) < climbRate) newAltitude = currentTargetAltitude;
            else newAltitude = plane.altitude + Math.sign(altDiff) * climbRate;
          }

          let newSpeed = plane.speed;
          if (plane.speed !== currentTargetSpeed) {
            const speedDiff = currentTargetSpeed - plane.speed;
            const accelRate = 0.25;
            if (Math.abs(speedDiff) < accelRate) newSpeed = currentTargetSpeed;
            else newSpeed = plane.speed + Math.sign(speedDiff) * accelRate;
          }

          const speedMultiplier = 0.0015;
          const dx = newSpeed * speedMultiplier * Math.sin(newHeading * Math.PI / 180);
          const dy = -newSpeed * speedMultiplier * Math.cos(newHeading * Math.PI / 180);
          const newX = plane.x + dx;
          const newY = plane.y + dy;

          const newTrail = [...plane.trail];
          if (newTrail.length === 0 || Math.hypot(newTrail[newTrail.length - 1].x - newX, newTrail[newTrail.length - 1].y - newY) > 12) {
            newTrail.push({ x: newX, y: newY });
            if (newTrail.length > 18) newTrail.shift();
          }

          let newStatus: Plane['status'] = plane.status === 'crashed' ? 'crashed' : 'normal';
          const distToCenter = Math.hypot(newX - airport.x, newY - airport.y);
          if (newStatus === 'normal') {
            if (distToCenter < 100 && newAltitude <= 2500 && !isEstablished) newStatus = 'bad_approach';
            else if (isEstablished && distToCenter < 50 && newSpeed > 160) newStatus = 'bad_approach';
          }

          return {
            ...plane,
            x: newX,
            y: newY,
            heading: newHeading,
            altitude: newAltitude,
            speed: newSpeed,
            trail: newTrail,
            targetHeading: currentTargetHeading,
            targetAltitude: currentTargetAltitude,
            targetSpeed: currentTargetSpeed,
            isEstablished,
            establishedRunwayId,
            status: newStatus,
            targetWaypoint: currentTargetWaypoint,
            markedForRemoval,
            conflict: false
          };
        });

        // 5. STCA Separation & Collision Checking
        for (let i = 0; i < nextPlanes.length; i++) {
          for (let j = i + 1; j < nextPlanes.length; j++) {
            const p1 = nextPlanes[i];
            const p2 = nextPlanes[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const altDiff = Math.abs(p1.altitude - p2.altitude);

            const p1Safe = p1.altitude < 1000;
            const p2Safe = p2.altitude < 1000;

            if (dist < 20 && altDiff < 1000 && !(p1Safe && p2Safe)) {
              if (!p1.markedForRemoval && !p2.markedForRemoval) {
                setAccidents(a => a + 1);
                p1.markedForRemoval = true;
                p2.markedForRemoval = true;
                p1.status = 'crashed';
                p2.status = 'crashed';
                audioManager.playCrash();
              }
            } else if (dist < 55 && altDiff < 1000 && !(p1Safe && p2Safe)) {
              p1.conflict = true;
              p2.conflict = true;
              if (p1.status !== 'crashed') p1.status = 'warning';
              if (p2.status !== 'crashed') p2.status = 'warning';
              if (!hadConflictSound) {
                audioManager.playWarning();
                hadConflictSound = true;
              }
            }
          }
        }

        // 6. Landing & Departure Exit Validation
        return nextPlanes.filter(plane => {
          if (plane.markedForRemoval) {
            if (plane.type === 'departure' && plane.status !== 'crashed') {
              setScore(s => s + 1);
              audioManager.playSuccess();
            }
            return false;
          }

          const distToCenter = Math.hypot(plane.x - airport.x, plane.y - airport.y);

          // Landing for arrivals
          if (plane.type === 'arrival') {
            const rwy = airport.runways.find(r => r.id === plane.establishedRunwayId);
            const rwyX = airport.x + (rwy?.offsetX || 0);
            const rwyY = airport.y + (rwy?.offsetY || 0);
            const distToRwy = Math.hypot(plane.x - rwyX, plane.y - rwyY);

            if (distToRwy < 30) {
              if (plane.isEstablished) {
                setScore(s => s + 1);
                audioManager.playSuccess();
                return false;
              }
              if (plane.altitude <= 2000) {
                const targetHdg = rwy ? rwy.heading : 0;
                let relHeading = (plane.heading - targetHdg + 360) % 360;
                const isAligned = relHeading > 340 || relHeading < 20;
                if (plane.speed <= 220 && isAligned) {
                  setScore(s => s + 1);
                  audioManager.playSuccess();
                  return false;
                } else {
                  setAccidents(a => a + 1);
                  audioManager.playCrash();
                  return false;
                }
              }
            }
          }
          
          return distToCenter < 2500;
        });
      });
    }, TICK_RATE / gameSpeed);

    return () => clearInterval(interval);
  }, [isPaused, spawnPlane, difficulty, gameSpeed, airport, config]);

  // Audio sweep
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => audioManager.playBlip(), 4000 / gameSpeed);
    return () => clearInterval(interval);
  }, [isPaused, gameSpeed]);

  const updatePlaneTarget = (id: string, updates: Partial<Plane>) => {
    setPlanes(prev => prev.map(p => p.id === id ? { ...p, ...updates, hasInstructions: true, goAround: updates.goAround ?? false } : p));
  };

  const togglePause = () => setIsPaused(p => !p);

  const restart = () => {
    setPlanes([]);
    setScore(0);
    setAccidents(0);
    setIsPaused(false);
    initializedRef.current = false;
    lastSpawnRef.current = 0;
  };

  return { planes, score, accidents, isPaused, togglePause, updatePlaneTarget, restart };
};


