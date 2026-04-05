// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VexilloClientProvider } from "../provider";
import { fetchFlags } from "../fetch-flags";
import { createVexilloClient } from "../client";
import { createMockVexilloClient } from "../testing";
import { useFlag } from "../use-flag";

function Child({ flagKey }: { flagKey: string }) {
  const [value] = useFlag(flagKey);
  return <div>{String(value)}</div>;
}

describe("SSR — renderToStaticMarkup with initialFlags", () => {
  it("renders with pre-seeded flags synchronously — no fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const client = createMockVexilloClient({ flags: { "some-flag": true } });

    const html = renderToStaticMarkup(
      <VexilloClientProvider client={client}>
        <Child flagKey="some-flag" />
      </VexilloClientProvider>,
    );

    expect(html).toContain("true");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("uses fallback for keys absent in initialFlags", () => {
    const client = createMockVexilloClient({
      flags: {},
      fallbacks: { "some-flag": true },
    });

    const html = renderToStaticMarkup(
      <VexilloClientProvider client={client}>
        <Child flagKey="some-flag" />
      </VexilloClientProvider>,
    );

    expect(html).toContain("true");
  });

  it("pre-fetch with fetchFlags then pass as initialFlags", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        flags: [{ key: "dark-mode", enabled: true }],
      }),
    } as unknown as Response);

    const initialFlags = await fetchFlags("https://vexillo.example.com", "sdk-key");
    const client = createVexilloClient({
      baseUrl: "https://vexillo.example.com",
      apiKey: "sdk-key",
      initialFlags,
    });

    expect(client.isReady).toBe(true);
    expect(client.getFlag("dark-mode")).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("fetchFlags", () => {
  it("returns parsed flag map on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        flags: [
          { key: "dark-mode", enabled: true },
          { key: "checkout-v2", enabled: false },
        ],
      }),
    } as unknown as Response);

    const flags = await fetchFlags("https://vexillo.example.com", "sdk-key");
    expect(flags).toEqual({ "dark-mode": true, "checkout-v2": false });
    vi.restoreAllMocks();
  });

  it("returns empty object on HTTP error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as unknown as Response);

    const flags = await fetchFlags("https://vexillo.example.com", "sdk-key");
    expect(flags).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("returns empty object on network error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network failure"));

    const flags = await fetchFlags("https://vexillo.example.com", "sdk-key");
    expect(flags).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
