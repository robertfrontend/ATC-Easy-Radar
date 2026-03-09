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
    const activeRunway = airport.runways[activeRunwayIndex] || airport.runways[0];
    // Force first plane to be a departure if it's the very first one, then 40% chance
    const isDeparture = planesRef.current.length === 0 ? true : Math.random() < 0.4;
    const { callsign, flag } = generateCallsign(airport);
    
    let x, y, heading, targetHeading, altitude, targetAltitude, speed, targetSpeed, targetWaypoint = null;

    if (isDeparture) {
      // Departures start at the airport with a small random offset
      x = airport.x + (Math.random() * 4 - 2);
      y = airport.y + (Math.random() * 4 - 2);
      
      // SAME heading as the runway (taking off forward)
      const departureHeading = activeRunway.heading;
      
      // Find waypoints that are "in front" of the runway
      const waypointsWithScore = airport.waypoints.map(wp => {
        const angleToWp = (Math.atan2(wp.y - airport.y, wp.x - airport.x) * 180 / Math.PI) + 90;
        const normalizedAngle = (angleToWp + 360) % 360;
        let diff = Math.abs(normalizedAngle - departureHeading);
        if (diff > 180) diff = 360 - diff;
        return { wp, diff };
      });
      
      // Pick the best waypoints that are in front of the takeoff path
      waypointsWithScore.sort((a, b) => a.diff - b.diff);
      const bestWaypoints = waypointsWithScore.slice(0, 2);
      const selectedWp = bestWaypoints[Math.floor(Math.random() * bestWaypoints.length)].wp;
      
      targetWaypoint = selectedWp.id;
      heading = departureHeading; // Start flying forward
      targetHeading = heading;

      altitude = 0;
      targetAltitude = 12000 + Math.floor(Math.random() * 8) * 1000;
      speed = 140;
      targetSpeed = 250 + Math.floor(Math.random() * 5) * 10;
    } else {
      // Arrivals spawn at the edge
      const angle = Math.random() * Math.PI * 2;
      const distance = 600;
      x = airport.x + Math.cos(angle) * distance;
      y = airport.y + Math.sin(angle) * distance;
      
      const angleToCenter = Math.atan2(airport.y - y, airport.x - x);
      heading = (angleToCenter * 180 / Math.PI) + 90;
      if (heading < 0) heading += 360;
      heading = (heading + (Math.random() * 60 - 30)) % 360;
      targetHeading = heading;

      altitude = 10000 + Math.floor(Math.random() * 20) * 1000;
      targetAltitude = altitude;
      speed = 250 + Math.floor(Math.random() * 10) * 10;
      targetSpeed = speed;
    }

    const newPlane: Plane = {
      id: Math.random().toString(36).substring(7),
      callsign,
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
      hasInstructions: isDeparture,
      targetWaypoint
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
      const minSpawnInterval = 4000 / gameSpeed; // Increased to 4s to be safer
      
      if (timeSinceLast > minSpawnInterval && (currentCount < config.minPlanes || (currentCount < config.maxPlanes && timeSinceLast > config.spawnRate / gameSpeed))) {
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
          let markedForRemoval = plane.markedForRemoval;
          if (currentTargetWaypoint && !isEstablished && plane.status !== 'crashed') {
            const wp = airport.waypoints.find(w => w.id === currentTargetWaypoint);
            if (wp) {
              const distToWp = Math.hypot(wp.x - plane.x, wp.y - plane.y);
              if (distToWp < 25) { // Increased distance slightly
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

          return { ...plane, x: newX, y: newY, heading: newHeading, altitude: newAltitude, speed: newSpeed, trail: newTrail, targetHeading: currentTargetHeading, targetAltitude: currentTargetAltitude, targetSpeed: currentTargetSpeed, isEstablished, status: newStatus, targetWaypoint: currentTargetWaypoint, markedForRemoval };
        });

        // Separation & Collisions
        for (let i = 0; i < nextPlanes.length; i++) {
          for (let j = i + 1; j < nextPlanes.length; j++) {
            const p1 = nextPlanes[i];
            const p2 = nextPlanes[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const altDiff = Math.abs(p1.altitude - p2.altitude);

            // COMPREHENSIVE COLLISION AVOIDANCE FOR TAKEOFFS/LANDINGS
            // Planes below 1000ft are considered "on runway/taking off/landing"
            // and won't collide with each other to prevent starting accidents.
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
            } else if (dist < 40 && altDiff < 1500) {
              if (p1.status !== 'crashed') p1.status = 'warning';
              if (p2.status !== 'crashed') p2.status = 'warning';
            }
          }
        }

        // Landing & Exit logic
        return nextPlanes.filter(plane => {
          if (plane.markedForRemoval) {
            // Only give points if it wasn't a crash
            if (plane.type === 'departure' && plane.status !== 'crashed') {
              setScore(s => s + 1);
              audioManager.playSuccess();
            }
            return false;
          }

          const distToCenter = Math.hypot(plane.x - airport.x, plane.y - airport.y);

          // ONLY ARRIVALS can land. Departures should not trigger landing logic.
          if (plane.type === 'arrival') {
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
