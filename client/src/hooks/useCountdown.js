import { useEffect, useRef, useState } from 'react';

/**
 * Time left until `deadline`, by the SERVER's clock: `serverNow` (from the last response) gives
 * the offset between this device's clock and the server's, so a wrong phone/PC clock can't add
 * or remove time. Ticks 4 times a second. Returns milliseconds left (never below 0), or null
 * until the first tick - so "0" always really means time is up (never "not counted yet").
 */
export function useCountdown(deadline, serverNow) {
  const offset = useRef(0);
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (serverNow) offset.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);

  useEffect(() => {
    if (!deadline) return undefined;
    const end = new Date(deadline).getTime();
    const tick = () => setLeft(Math.max(0, end - (Date.now() + offset.current)));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [deadline]);

  return deadline ? left : null;
}
