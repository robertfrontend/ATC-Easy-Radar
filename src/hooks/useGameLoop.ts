import { useState, useEffect, useRef, useCallback } from 'react';

export interface Plane {
  id: string;
  callsign: string;
  x: number;
  y: number;
  heading: number;
  targetHeading: number;
  altitude: number;
  targetAltitude: number;
  speed: number;
  targetSpeed: number;
  trail: { x: number; y: number }[];
  status: 'normal' | 'warning' | 'crashed';
  isEstablished: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

const getSpawnRate = (difficulty: Difficulty) => {
  switch (difficulty) {
    case 'easy': return 60000; // 1 minute
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
  const [gameOver, setGameOver] = useState(false);
  const lastSpawnRef = useRef(0);

  const spawnPlane = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 480; // Just inside the 500 radius
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
      isEstablished: false
    };
    
    setPlanes(prev => [...prev, newPlane]);
  }, []);

  useEffect(() => {
    if (gameOver) return;

    const interval = setInterval(() => {
      const now = Date.now();
      
      // Spawn new planes
      if (now - lastSpawnRef.current > getSpawnRate(difficulty) / gameSpeed) {
        spawnPlane();
        lastSpawnRef.current = now;
      }

      setPlanes(prevPlanes => {
        let nextPlanes = [...prevPlanes];
        let newGameOver = false;

        // Update positions and states
        nextPlanes = nextPlanes.map(plane => {
          let currentTargetHeading = plane.targetHeading;
          let currentTargetAltitude = plane.targetAltitude;
          let currentTargetSpeed = plane.targetSpeed;
          let isEstablished = plane.isEstablished;

          // ILS Capture Logic
          if (!isEstablished && plane.status !== 'crashed') {
            const inILSCone = plane.y > 500 && plane.y < 950 && Math.abs(plane.x - 500) <= (plane.y - 500) * 0.15;
            const isHeadingNorthish = plane.heading > 270 || plane.heading < 90;
            
            if (inILSCone && plane.altitude <= 5000 && isHeadingNorthish) {
              isEstablished = true;
            }
          }

          if (isEstablished && plane.status !== 'crashed') {
            const offset = plane.x - 500;
            // Steer towards centerline (x = 500)
            let correctionHeading = offset < 0 ? Math.min(30, -offset * 1.5) : 360 - Math.min(30, offset * 1.5);
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
          const speedMultiplier = 0.0005; // Adjust for game speed
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
              newGameOver = true;
              p1.status = 'crashed';
              p2.status = 'crashed';
            } else if (dist < 40 && altDiff < 1500) {
              p1.status = 'warning';
              p2.status = 'warning';
            } else {
              if (p1.status === 'warning') p1.status = 'normal';
              if (p2.status === 'warning') p2.status = 'normal';
            }
          }
        }

        // Landing and boundary logic
        const planesToKeep = nextPlanes.filter(plane => {
          const distToCenter = Math.hypot(plane.x - 500, plane.y - 500);
          
          // Landing zone check
          if (distToCenter < 20) {
            if (plane.altitude <= 2000) {
              const isAligned = plane.heading > 340 || plane.heading < 20;
              if (plane.speed <= 160 && isAligned) {
                // Successful landing
                setScore(s => s + 1);
                return false; // Remove plane
              } else {
                // Crash at airport (too fast or not aligned)
                newGameOver = true;
                plane.status = 'crashed';
                return true;
              }
            }
            // If altitude > 2000, just overfly safely
          }
          
          // Remove planes that fly too far away (handoff to next sector)
          if (distToCenter > 600) {
             return false;
          }
          
          return true;
        });

        if (newGameOver) {
          setGameOver(true);
        }

        return planesToKeep;
      });
    }, TICK_RATE / gameSpeed);

    return () => clearInterval(interval);
  }, [gameOver, spawnPlane, difficulty, gameSpeed]);

  const updatePlaneTarget = (id: string, updates: Partial<Plane>) => {
    setPlanes(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const restart = () => {
    setPlanes([]);
    setScore(0);
    setGameOver(false);
    lastSpawnRef.current = Date.now();
  };

  return { planes, score, gameOver, updatePlaneTarget, restart };
};
