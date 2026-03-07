import { useState, useEffect, useRef, useCallback } from 'react';
import { Plane, Difficulty } from '../types';

export type { Plane, Difficulty };

export const WAYPOINTS = [
  { id: 'WP-A', label: 'ALPHA',   x: 500, y: 100 },  // N
  { id: 'WP-B', label: 'BRAVO',   x: 830, y: 170 },  // NE
  { id: 'WP-C', label: 'CHARLIE', x: 900, y: 500 },  // E
  { id: 'WP-D', label: 'DELTA',   x: 830, y: 830 },  // SE
  { id: 'WP-E', label: 'ECHO',    x: 170, y: 830 },  // SW
  { id: 'WP-F', label: 'FOXTROT', x: 100, y: 500 },  // W
  { id: 'WP-G', label: 'GOLF',    x: 170, y: 170 },  // NW
];


const getSpawnRate = (difficulty: Difficulty, score: number) => {
  switch (difficulty) {
    case 'easy': return Math.max(20000, 60000 - score * 2000); // 1 minute, drops by 2s per point, min 20s
    case 'medium': return 30000; // 30 seconds
    case 'hard': return 15000; // 15 seconds
    default: return 60000;
  }
};

const TICK_RATE = 50; // ms

const generateCallsign = () => {
  const airlines = ['AAL', 'DAL', 'UAL', 'SWA', 'JBU', 'BAW', 'AFR', 'DLH'];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${airlines[Math.floor(Math.random() * airlines.length)]}${num}`;
};

export const useGameLoop = (difficulty: Difficulty, gameSpeed: number = 1) => {
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [score, setScore] = useState(0);
  const [accidents, setAccidents] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastSpawnRef = useRef(0);
  const initializedRef = useRef(false);

  const spawnPlane = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 600; // Spawn just outside the core 1000x1000 area
    const x = 500 + Math.cos(angle) * distance;
    const y = 500 + Math.sin(angle) * distance;
    
    // Point towards center roughly
    const angleToCenter = Math.atan2(500 - y, 500 - x);
    let heading = (angleToCenter * 180 / Math.PI) + 90;
    if (heading < 0) heading += 360;
    
    // Add some randomness to heading
    heading = (heading + (Math.random() * 60 - 30)) % 360;

    const newPlane: Plane = {
      id: Math.random().toString(36).substring(7),
      callsign: generateCallsign(),
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
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      // Initial spawn
      if (!initializedRef.current) {
        spawnPlane();
        setTimeout(spawnPlane, 2000); // Spawn a second plane shortly after
        initializedRef.current = true;
        lastSpawnRef.current = now;
      }

      // Spawn new planes
      if (now - lastSpawnRef.current > getSpawnRate(difficulty, score) / gameSpeed) {
        spawnPlane();
        lastSpawnRef.current = now;
      }

      setPlanes(prevPlanes => {
        let nextPlanes = [...prevPlanes];

        // Update positions and states
        nextPlanes = nextPlanes.map(plane => {
          let currentTargetHeading = plane.targetHeading;
          let currentTargetAltitude = plane.targetAltitude;
          let currentTargetSpeed = plane.targetSpeed;
          let isEstablished = plane.isEstablished;
          let currentTargetWaypoint = plane.targetWaypoint;

          // Waypoint logic
          if (currentTargetWaypoint && !isEstablished && plane.status !== 'crashed') {
            const wp = WAYPOINTS.find(w => w.id === currentTargetWaypoint);
            if (wp) {
              const distToWp = Math.hypot(wp.x - plane.x, wp.y - plane.y);
              if (distToWp < 20) {
                currentTargetWaypoint = null; // Reached waypoint
              } else {
                let headingToWp = (Math.atan2(wp.y - plane.y, wp.x - plane.x) * 180 / Math.PI) + 90;
                currentTargetHeading = (Math.round(headingToWp) + 360) % 360;
              }
            }
          }

          // ILS Capture Logic
          if (!isEstablished && !plane.goAround && plane.status !== 'crashed') {
            // Wider and longer ILS cone for easier capture
            const inILSCone = plane.y > 500 && plane.y < 1500 && Math.abs(plane.x - 500) <= (plane.y - 500) * 0.2;
            // Very forgiving heading requirement (almost anything pointing generally North)
            const isHeadingNorthish = plane.heading > 250 || plane.heading < 110;

            // Allow capture up to 10,000ft
            if (inILSCone && plane.altitude <= 10000 && isHeadingNorthish) {
              isEstablished = true;
            }
          }

          if (isEstablished && plane.status !== 'crashed') {
            const offset = plane.x - 500;
            // Steer towards centerline (x = 500)
            let correctionHeading = offset < 0 ? Math.min(45, -offset * 2) : 360 - Math.min(45, offset * 2);
            if (correctionHeading === 360) correctionHeading = 0;
            
            currentTargetHeading = correctionHeading;
            currentTargetAltitude = 0;
            currentTargetSpeed = 140;
          }

          // Turn logic (max 0.5 degrees per tick)
          let newHeading = plane.heading;
          if (plane.heading !== currentTargetHeading) {
            let diff = currentTargetHeading - plane.heading;
            // Normalize diff to -180 to 180
            while (diff <= -180) diff += 360;
            while (diff > 180) diff -= 360;
            
            const turnRate = 0.5;
            if (Math.abs(diff) < turnRate) {
              newHeading = currentTargetHeading;
            } else {
              newHeading = (plane.heading + Math.sign(diff) * turnRate + 360) % 360;
            }
          }

          // Altitude logic (max 25ft per tick)
          let newAltitude = plane.altitude;
          if (plane.altitude !== currentTargetAltitude) {
            const altDiff = currentTargetAltitude - plane.altitude;
            const climbRate = 15;
            if (Math.abs(altDiff) < climbRate) {
              newAltitude = currentTargetAltitude;
            } else {
              newAltitude = plane.altitude + Math.sign(altDiff) * climbRate;
            }
          }

          // Speed logic (max 0.5kt per tick)
          let newSpeed = plane.speed;
          if (plane.speed !== currentTargetSpeed) {
            const speedDiff = currentTargetSpeed - plane.speed;
            const accelRate = 0.2;
            if (Math.abs(speedDiff) < accelRate) {
              newSpeed = currentTargetSpeed;
            } else {
              newSpeed = plane.speed + Math.sign(speedDiff) * accelRate;
            }
          }

          // Movement logic
          const speedMultiplier = 0.0015; // Increased for better gameplay pacing
          const dx = newSpeed * speedMultiplier * Math.sin(newHeading * Math.PI / 180);
          const dy = -newSpeed * speedMultiplier * Math.cos(newHeading * Math.PI / 180);

          const newX = plane.x + dx;
          const newY = plane.y + dy;

          // Trail logic
          const newTrail = [...plane.trail];
          if (newTrail.length === 0 || Math.hypot(newTrail[newTrail.length - 1].x - newX, newTrail[newTrail.length - 1].y - newY) > 15) {
            newTrail.push({ x: newX, y: newY });
            if (newTrail.length > 15) newTrail.shift();
          }

          let newStatus: Plane['status'] = plane.status === 'crashed' ? 'crashed' : 'normal';
          const distToCenter = Math.hypot(newX - 500, newY - 500);
          
          if (newStatus === 'normal') {
            if (distToCenter < 100 && newAltitude <= 2500 && !isEstablished) {
              newStatus = 'bad_approach';
            } else if (isEstablished && distToCenter < 50 && newSpeed > 160) {
              newStatus = 'bad_approach';
            }
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
            status: newStatus,
            targetWaypoint: currentTargetWaypoint,
          };
        });

        // Collision detection
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
              }
            } else if (dist < 40 && altDiff < 1500) {
              if (p1.status !== 'crashed') p1.status = 'warning';
              if (p2.status !== 'crashed') p2.status = 'warning';
            }
          }
        }

        // Landing and boundary logic
        const planesToKeep = nextPlanes.filter(plane => {
          if (plane.markedForRemoval) return false;

          const distToCenter = Math.hypot(plane.x - 500, plane.y - 500);
          
          // Landing zone check
          if (distToCenter < 20) {
            if (plane.altitude <= 3000) {
              const isAligned = plane.heading > 330 || plane.heading < 30;
              if (plane.speed <= 200 && isAligned) {
                // Successful landing
                setScore(s => s + 1);
                return false; // Remove plane
              } else {
                // Crash at airport (too fast or not aligned)
                setAccidents(a => a + 1);
                return false; // Remove plane
              }
            }
            // If altitude > 3000, just overfly safely
          }
          
          // Remove planes that fly too far away (handoff to next sector)
          if (distToCenter > 2500) {
             return false;
          }
          
          return true;
        });

        return planesToKeep;
      });
    }, TICK_RATE / gameSpeed);

    return () => clearInterval(interval);
  }, [isPaused, spawnPlane, difficulty, gameSpeed, score]);

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
