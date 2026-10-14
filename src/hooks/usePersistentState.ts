import { useEffect, useRef, useState } from 'react';

/**
 * Estado que se recuerda entre sesiones (localStorage), tolerante a errores
 * (modo privado, cuota llena, JSON corrupto). Solo para preferencias de UI.
 */
export function usePersistentState<T>(key: string, initial: T, validate?: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      if (validate && !validate(parsed)) return initial;
      return parsed as T;
    } catch {
      return initial;
    }
  });

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sin persistencia disponible */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
