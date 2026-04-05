import { use, version } from "react";

// Augment Promise with suspense state tracked inline.
type SuspensePromise<T> = Promise<T> & {
  status?: "pending" | "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
};

/**
 * Reads a Promise value, suspending if not yet resolved.
 *
 * - React 19+: delegates to the native `React.use()` hook.
 * - React 18: uses the throw-Promise pattern (the undocumented mechanism
 *   that powers Suspense data fetching in React 18).
 */
export function usePromise<T>(promise: Promise<T>): T {
  const major = parseInt(version.split(".")[0], 10);

  if (major >= 19 && typeof use === "function") {
    return use(promise);
  }

  return readPromise(promise as SuspensePromise<T>);
}

function readPromise<T>(promise: SuspensePromise<T>): T {
  if (promise.status === "fulfilled") {
    return promise.value as T;
  }

  if (promise.status === "rejected") {
    throw promise.reason;
  }

  if (promise.status === "pending") {
    throw promise;
  }

  // First read — wire up status tracking and suspend.
  promise.status = "pending";
  promise.then(
    (value) => {
      promise.status = "fulfilled";
      promise.value = value;
    },
    (reason: unknown) => {
      promise.status = "rejected";
      promise.reason = reason;
    },
  );
  throw promise;
}
