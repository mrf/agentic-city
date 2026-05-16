import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps Tab/Shift+Tab focus cycles within a container element.
 * When active, Tab from the last focusable element wraps to the first,
 * and Shift+Tab from the first wraps to the last.
 * If no focusable children exist, Tab is prevented from escaping.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === el) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last || document.activeElement === el) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [containerRef, active]);
}

/**
 * Saves the focused element when `active` becomes true, then restores
 * focus to it when `active` becomes false (e.g. modal dismissed).
 */
export function useFocusRestore(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const saved = document.activeElement as HTMLElement | null;
    return () => {
      saved?.focus();
    };
  }, [active]);
}
