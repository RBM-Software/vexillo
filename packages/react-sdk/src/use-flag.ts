import { useState, useEffect } from "react";
import { useVexilloClientContext } from "./provider";

/**
 * Returns `[value, isLoading]` for a feature flag key.
 *
 * - `value` — current boolean value. Falls back to `fallbacks` config then
 *   `false` for unknown keys or while the client is still loading.
 * - `isLoading` — `true` until the client has loaded at least once. Use this
 *   to suppress flag-gated UI until flags are known, avoiding
 *   flash-of-wrong-content in SPAs:
 *   ```tsx
 *   const [newCheckout, isLoading] = useFlag("new-checkout");
 *   if (isLoading) return null;
 *   return newCheckout ? <NewCheckout /> : <OldCheckout />;
 *   ```
 *
 * Re-renders only when this specific key's value changes.
 *
 * @throws if called outside a `<VexilloClientProvider>`.
 */
export function useFlag(key: string): [value: boolean, isLoading: boolean] {
  const client = useVexilloClientContext();

  const [state, setState] = useState(() => ({
    value: client.getFlag(key),
    isLoading: !client.isReady,
  }));

  useEffect(() => {
    setState({
      value: client.getFlag(key),
      isLoading: !client.isReady,
    });

    return client.subscribe(key, () => {
      setState({
        value: client.getFlag(key),
        isLoading: !client.isReady,
      });
    });
  }, [client, key]);

  return [state.value, state.isLoading];
}
