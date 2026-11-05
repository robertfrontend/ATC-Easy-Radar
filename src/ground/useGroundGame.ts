import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroundCommand } from './model';
import { advanceGround, commandGround, createGroundState } from './simulation';

/** One clock per mounted mode. Commands and frames share the latest state. */
export function useGroundGame() {
  const [state, setState] = useState(createGroundState);
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    let frame: number;
    previous.current = undefined;
    let mounted = true;
    const tick = (timestamp: number) => {
      if (!mounted) return;
      if (previous.current !== undefined) {
        const seconds = Math.max(0, (timestamp - previous.current) / 1000);
        setState(current => advanceGround(current, seconds));
      }
      previous.current = timestamp;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { mounted = false; cancelAnimationFrame(frame); };
  }, []);
  const dispatch = useCallback((command: GroundCommand) => {
    if (command.type === 'restart') previous.current = undefined;
    setState(current => commandGround(current, command));
  }, []);
  return { state, dispatch };
}
