import { useEffect, useState } from 'react';

/** The value, but only once it has stopped changing for `delayMs`. Starts with the first value. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  // A timer is outside React, so an effect: every change restarts it, and cleanup cancels the old one.
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
