import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plane, Difficulty, Airport } from '../types';
import { audioManager } from '../utils/audio';

export type { Plane, Difficulty };

const TICK_RATE = 50; // ms

const DIFFICULTY_CONFIG = {
  easy:   { maxPlanes: 4,  minPlanes: 2, spawnRate: 20000, ilsWidth: 0.4 },
  medium: { maxPlanes: 8,  minPlanes: 4, spawnRate: 15000, ilsWidth: 0.2 },
  hard:   { maxPlanes: 12, minPlanes: 6, spawnRate: 8000,  ilsWidth: 0.12 }
};

const generateCallsign = (airport: Airport) => {
  // Weighted random airline selection
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
  return { callsign: `${selectedAirline.code}${num}`, flag: selectedAirline.flag };
};

export const useGameLoop = (airport: Airport, activeRunwayIndex: number, difficulty: Difficulty, gameSpeed: number = 1) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const activeRunway = useMemo(() => airport.runways[activeRunwayIndex] || airport.runways[0], [airport, activeRunwayIndex]);
  
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [score, setScore] = useState(0);
  const [accidents, setAccidents] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const lastSpawnRef = useRef(0);
  const initializedRef = useRef(false);
  const planesRef = useRef<Plane[]>([]);

  // Keep ref in sync for interval access without dependency restart
  useEffect(() => {
    planesRef.current = planes;
  }, [planes]);

  const spawnPlane = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 600;
    const x = airport.x + Math.cos(angle) * distance;
    const y = airport.y + Math.sin(angle) * distance;
    
    const angleToCenter = Math.atan2(airport.y - y, airport.x - x);
    let heading = (angleToCenter * 180 / Math.PI) + 90;
    if (heading < 0) heading += 360;
    heading = (heading + (Math.random() * 60 - 30)) % 360;

    const { callsign, flag } = generateCallsign(airport);

    const newPlane: Plane = {
      id: Math.random().toString(36).substring(7),
      callsign,
      originFlag: flag,
      x,
      y,
      heading,
      targetHeading: heading,
      altitude: 10000 + Math.floor(Math.random() * 20) * 1000,
      targetAltitude: 10000 + Math.floor(Math.random() * 20) * 1000,
      speed: 250 + Math.floor(Math.random() * 10) * 10,
      targetSpeed: 250 + Math.floor(Math.random() * 10) * 10,
      trail: [],
      status: 'normal',
      isEstablished: false,
      hasInstructions: false,
      targetWaypoint: null
    };
    
    setPlanes(prev => [...prev, newPlane]);
    audioManager.playBlip();
  }, [airport]);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      if (!initializedRef.current) {
        spawnPlane();
        initializedRef.current = true;
        lastSpawnRef.current = now;
      }

      // Dynamic Spawn
      const currentCount = planesRef.current.length;
      const timeSinceLast = now - lastSpawnRef.current;
      
      if (currentCount < config.minPlanes || (currentCount < config.maxPlanes && timeSinceLast > config.spawnRate / gameSpeed)) {
        spawnPlane();
        lastSpawnRef.current = now;
      }

      setPlanes(prevPlanes => {
        let nextPlanes = prevPlanes.map(plane => {
          let currentTargetHeading = plane.targetHeading;
          let currentTargetAltitude = plane.targetAltitude;
          let currentTargetSpeed = plane.targetSpeed;
          let isEstablished = plane.isEstablished;
          let currentTargetWaypoint = plane.targetWaypoint;

          // Waypoint logic
          if (currentTargetWaypoint && !isEstablished && plane.status !== 'crashed') {
            const wp = airport.waypoints.find(w => w.id === currentTargetWaypoint);
            if (wp) {
              const distToWp = Math.hypot(wp.x - plane.x, wp.y - plane.y);
              if (distToWp < 20) {
                currentTargetWaypoint = null;
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

          // ILS Logic
          if (!isEstablished && !plane.goAround && plane.status !== 'crashed') {
            const dx = plane.x - airport.x;
            const dy = plane.y - airport.y;
            const rad = -activeRunway.heading * Math.PI / 180;
            const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
            const rotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);

            const inILSCone = rotatedY > 28 && rotatedY < 500 && Math.abs(rotatedX) <= rotatedY * config.ilsWidth;
            let relHeading = (plane.heading - activeRunway.heading + 360) % 360;
            const isHeadingAligned = relHeading > 310 || relHeading < 50;

            if (inILSCone && plane.altitude <= 10000 && isHeadingAligned) {
              isEstablished = true;
            }
          }

          if (isEstablished && plane.status !== 'crashed') {
             const dx = plane.x - airport.x;
             const dy = plane.y - airport.y;
             const rad = -activeRunway.heading * Math.PI / 180;
             const rotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
             let correction = rotatedX < 0 ? Math.min(30, -rotatedX * 2) : -Math.min(30, rotatedX * 2);
             currentTargetHeading = (activeRunway.heading + correction + 360) % 360;
             currentTargetAltitude = 0;
             currentTargetSpeed = 140;
          }

          // Movement Physics
          let newHeading = plane.heading;
          if (plane.heading !== currentTargetHeading) {
            let diff = currentTargetHeading - plane.heading;
            while (diff <= -180) diff += 360;
            while (diff > 180) diff -= 360;
            const turnRate = 0.5;
            if (Math.abs(diff) < turnRate) newHeading = currentTargetHeading;
            else newHeading = (plane.heading + Math.sign(diff) * turnRate + 360) % 360;
          }

          let newAltitude = plane.altitude;
          if (plane.altitude !== currentTargetAltitude) {
            const altDiff = currentTargetAltitude - plane.altitude;
            const climbRate = 15;
            if (Math.abs(altDiff) < climbRate) newAltitude = currentTargetAltitude;
            else newAltitude = plane.altitude + Math.sign(altDiff) * climbRate;
          }

          let newSpeed = plane.speed;
          if (plane.speed !== currentTargetSpeed) {
            const speedDiff = currentTargetSpeed - plane.speed;
            const accelRate = 0.2;
            if (Math.abs(speedDiff) < accelRate) newSpeed = currentTargetSpeed;
            else newSpeed = plane.speed + Math.sign(speedDiff) * accelRate;
          }

          const speedMultiplier = 0.0015;
          const dx = newSpeed * speedMultiplier * Math.sin(newHeading * Math.PI / 180);
          const dy = -newSpeed * speedMultiplier * Math.cos(newHeading * Math.PI / 180);
          const newX = plane.x + dx;
          const newY = plane.y + dy;

          const newTrail = [...plane.trail];
          if (newTrail.length === 0 || Math.hypot(newTrail[newTrail.length - 1].x - newX, newTrail[newTrail.length - 1].y - newY) > 15) {
            newTrail.push({ x: newX, y: newY });
            if (newTrail.length > 15) newTrail.shift();
          }

          let newStatus: Plane['status'] = plane.status === 'crashed' ? 'crashed' : 'normal';
          const distToCenter = Math.hypot(newX - airport.x, newY - airport.y);
          if (newStatus === 'normal') {
            if (distToCenter < 100 && newAltitude <= 2500 && !isEstablished) newStatus = 'bad_approach';
            else if (isEstablished && distToCenter < 50 && newSpeed > 160) newStatus = 'bad_approach';
          }

          return { ...plane, x: newX, y: newY, heading: newHeading, altitude: newAltitude, speed: newSpeed, trail: newTrail, targetHeading: currentTargetHeading, targetAltitude: currentTargetAltitude, targetSpeed: currentTargetSpeed, isEstablished, status: newStatus, targetWaypoint: currentTargetWaypoint };
        });

        // Separation & Collisions
        for (let i = 0; i < nextPlanes.length; i++) {
          for (let j = i + 1; j < nextPlanes.length; j++) {
            const p1 = nextPlanes[i];
            const p2 = nextPlanes[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const altDiff = Math.abs(p1.altitude - p2.altitude);
            if (dist < 20 && altDiff < 1000) {
              if (!p1.markedForRemoval && !p2.markedForRemoval) {
                setAccidents(a => a + 1);
                p1.markedForRemoval = true;
                p2.markedForRemoval = true;
                audioManager.playCrash();
              }
            } else if (dist < 40 && altDiff < 1500) {
              if (p1.status !== 'crashed') p1.status = 'warning';
              if (p2.status !== 'crashed') p2.status = 'warning';
            }
          }
        }

        // Landing & Exit logic
        return nextPlanes.filter(plane => {
          if (plane.markedForRemoval) return false;
          const distToCenter = Math.hypot(plane.x - airport.x, plane.y - airport.y);
          if (distToCenter < 25) {
            if (plane.isEstablished) {
              setScore(s => s + 1);
              audioManager.playSuccess();
              return false;
            }
            if (plane.altitude <= 2000) {
              let relHeading = (plane.heading - activeRunway.heading + 360) % 360;
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
          return distToCenter < 2500;
        });
      });
    }, TICK_RATE / gameSpeed);

    return () => clearInterval(interval);
  }, [isPaused, spawnPlane, difficulty, gameSpeed, airport, config, activeRunway]);

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
