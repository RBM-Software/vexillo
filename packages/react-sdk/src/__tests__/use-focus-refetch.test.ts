import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useFocusRefetch } from "../use-focus-refetch";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFocusRefetch", () => {
  it("calls the callback when window gains focus", () => {
    const callback = vi.fn();
    renderHook(() => useFocusRefetch(callback));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(callback).toHaveBeenCalledOnce();
  });

  it("does not call the callback after unmount (listener is cleaned up)", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useFocusRefetch(callback));

    unmount();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the latest callback without re-registering the listener", () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ cb }) => useFocusRefetch(cb), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});
