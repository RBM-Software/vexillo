import { useEffect, useRef } from "react";

/**
 * Calls `callback` whenever the browser window regains focus.
 * Cleans up the listener on unmount.
 *
 * Uses a ref so the listener is registered once — re-renders that change the
 * callback do not re-attach the event listener.
 */
export function useFocusRefetch(callback: () => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function handler() {
      callbackRef.current();
    }
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);
}
