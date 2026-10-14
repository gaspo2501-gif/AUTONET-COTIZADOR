import { useEffect, useRef } from 'react';

const stack: number[] = [];
let seq = 0;

/**
 * Comportamiento estándar de cualquier modal/hoja:
 * - Cierra con Escape (solo el modal que está más arriba).
 * - Bloquea el scroll del fondo mientras haya algún modal abierto.
 * Pasar `undefined` como onClose desactiva temporalmente el cierre con Escape
 * (p. ej. cuando hay un sub-modal propio abierto).
 */
export function useModalBehavior(onClose: (() => void) | undefined, enabled = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const id = ++seq;
    stack.push(id);
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id) return;
      if (closeRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) document.body.style.overflow = '';
    };
  }, [enabled]);
}
