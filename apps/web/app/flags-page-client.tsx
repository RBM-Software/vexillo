"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import CreateFlagForm from "@/app/components/create-flag-form";
import { ConfirmFlagToggleDialog } from "@/components/confirm-flag-toggle-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type EnvironmentRef = { id: string; name: string; slug: string };

const PRIMARY_ENV_STORAGE_KEY = "vexillo.primary-environment-id";

function pickDefaultPrimaryEnvId(envs: EnvironmentRef[]) {
  if (envs.length === 0) return "";
  const prod = envs.find((e) => e.slug === "production" || e.slug === "prod");
  return (prod ?? envs[0]).id;
}

export type FlagsPageFlag = {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  states: Record<string, boolean>;
};

export default function FlagsPageClient({
  initialFlags,
  initialEnvironments,
  isAdmin,
}: {
  initialFlags: FlagsPageFlag[];
  initialEnvironments: EnvironmentRef[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isListPending, startListTransition] = React.useTransition();
  const [flags, setFlags] = React.useState(initialFlags);
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [toggleBusy, setToggleBusy] = React.useState<string | null>(null);
  const [primaryEnvId, setPrimaryEnvId] = React.useState<string>(() =>
    pickDefaultPrimaryEnvId(initialEnvironments),
  );
  const [confirmToggle, setConfirmToggle] = React.useState<null | {
    flagKey: string;
    flagName: string;
    envId: string;
    envName: string;
    currentEnabled: boolean;
    nextEnabled: boolean;
  }>(null);
  const [confirmBusy, setConfirmBusy] = React.useState(false);

  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  /** Drop-shadow on sticky column only while scrolled — signals overlap, not default chrome. */
  const [stickyEdgeShadow, setStickyEdgeShadow] = React.useState(false);

  const primaryEnv =
    initialEnvironments.find((e) => e.id === primaryEnvId) ?? initialEnvironments[0] ?? null;

  const syncStickyEdgeShadow = React.useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setStickyEdgeShadow(el.scrollLeft > 1);
  }, []);

  React.useEffect(() => {
    setFlags(initialFlags);
  }, [initialFlags]);

  React.useEffect(() => {
    if (initialEnvironments.length === 0) return;
    try {
      const raw = localStorage.getItem(PRIMARY_ENV_STORAGE_KEY);
      if (raw && initialEnvironments.some((e) => e.id === raw)) {
        setPrimaryEnvId(raw);
      }
    } catch {
      /* ignore */
    }
  }, [initialEnvironments]);

  React.useEffect(() => {
    if (initialEnvironments.length === 0) return;
    if (!initialEnvironments.some((e) => e.id === primaryEnvId)) {
      setPrimaryEnvId(pickDefaultPrimaryEnvId(initialEnvironments));
    }
  }, [initialEnvironments, primaryEnvId]);

  React.useEffect(() => {
    if (!primaryEnvId) return;
    try {
      localStorage.setItem(PRIMARY_ENV_STORAGE_KEY, primaryEnvId);
    } catch {
      /* ignore */
    }
  }, [primaryEnvId]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q),
    );
  }, [flags, query]);

  React.useLayoutEffect(() => {
    syncStickyEdgeShadow();
  }, [syncStickyEdgeShadow, filtered.length, initialEnvironments.length, primaryEnv?.id]);

  React.useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncStickyEdgeShadow());
    ro.observe(el);
    el.addEventListener("scroll", syncStickyEdgeShadow, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", syncStickyEdgeShadow);
    };
  }, [syncStickyEdgeShadow]);

  async function handleCreate(data: {
    name: string;
    key: string;
    description: string;
  }) {
    const res = await fetch("/api/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(typeof err.error === "string" ? err.error : "Failed to create flag");
    }
    setCreateOpen(false);
    startListTransition(() => {
      router.refresh();
    });
  }

  async function performToggle(flagKey: string, environmentId: string): Promise<boolean> {
    const busyKey = `${flagKey}:${environmentId}`;
    setToggleBusy(busyKey);
    try {
      const res = await fetch(`/api/flags/${encodeURIComponent(flagKey)}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail =
          typeof err.error === "string"
            ? err.error
            : `Could not update flag (${res.status}). Try again.`;
        toast.error(detail);
        return false;
      }
      const { enabled } = (await res.json()) as { enabled: boolean };
      setFlags((prev) =>
        prev.map((f) => {
          if (f.key !== flagKey) return f;
          const env = initialEnvironments.find((e) => e.id === environmentId);
          if (!env) return f;
          return {
            ...f,
            states: { ...f.states, [env.slug]: enabled },
          };
        }),
      );
      return true;
    } finally {
      setToggleBusy(null);
    }
  }

  const listIsEmpty = !query.trim() && filtered.length === 0;

  return (
    <div className="page-container page-container-wide flex flex-1 flex-col">
      <header className="page-enter mb-8 md:mb-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-lg">
            <h1 className="page-title">Feature flags</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Toggle flags per environment. Changes apply on the next SDK fetch.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open a flag&apos;s page to compare all environments in one place.
            </p>
          </div>
          {isAdmin ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger render={<Button className="shrink-0 gap-2" />}>
                <Plus className="size-4" aria-hidden />
                New flag
              </DialogTrigger>
              <DialogContent
                className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg"
                showCloseButton
              >
                <DialogHeader>
                  <DialogTitle>New flag</DialogTitle>
                  <DialogDescription>
                    Add a flag and enable it per environment after creation.
                  </DialogDescription>
                </DialogHeader>
                <CreateFlagForm
                  onSubmit={handleCreate}
                  onCancel={() => setCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </header>

      <div className="page-enter page-enter-delay-1 mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative max-w-md min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search flags…"
            className="h-9 ps-10"
            aria-label="Search flags"
          />
        </div>
        {initialEnvironments.length > 0 ? (
          <div className="flex w-full min-w-48 flex-col gap-1.5 sm:w-auto sm:max-w-[16rem]">
            <Label htmlFor="primary-env" className="text-xs text-muted-foreground">
              Showing values for
            </Label>
            <select
              id="primary-env"
              className={cn(
                "h-9 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-xs",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              value={primaryEnv?.id ?? ""}
              onChange={(e) => setPrimaryEnvId(e.target.value)}
              aria-label="Environment shown in list"
            >
              {initialEnvironments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p className="text-sm tabular-nums text-muted-foreground lg:ms-auto">
          <span className="font-medium text-foreground">{filtered.length}</span>
          {filtered.length === 1 ? " flag" : " flags"}
        </p>
      </div>

      {initialEnvironments.length === 0 ? (
        <Alert className="page-enter page-enter-delay-2 max-w-lg [&>svg]:text-muted-foreground">
          <Info aria-hidden />
          <AlertTitle>No environments yet</AlertTitle>
          <AlertDescription className="mt-2 block space-y-4">
            <span className="block">Create an environment to enable columns here.</span>
            {isAdmin ? (
              <Button className="w-full sm:w-auto" onClick={() => router.push("/environments")}>
                Go to environments
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : query.trim() && filtered.length === 0 ? (
        <Alert className="page-enter page-enter-delay-2 max-w-lg [&>svg]:text-muted-foreground">
          <Info aria-hidden />
          <AlertTitle>No matches</AlertTitle>
          <AlertDescription>Try another search term.</AlertDescription>
        </Alert>
      ) : listIsEmpty && isListPending ? (
        <div
          className="page-enter page-enter-delay-2 flex flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-muted/25 py-16 text-center"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading flags"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Updating flags…</p>
        </div>
      ) : listIsEmpty ? (
        <Alert className="page-enter page-enter-delay-2 max-w-lg [&>svg]:text-muted-foreground">
          <Info aria-hidden />
          <AlertTitle>No flags yet</AlertTitle>
          <AlertDescription className="mt-2 block space-y-4">
            <span className="block">Create a flag to see it here.</span>
            {isAdmin ? (
              <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
                New flag
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : primaryEnv ? (
        <div
          className={cn(
            "table-shell page-enter page-enter-delay-2 transition-opacity duration-200",
            isListPending && "pointer-events-none opacity-55",
          )}
          aria-busy={isListPending}
        >
          <Table ref={tableScrollRef} className="data-table">
            <TableHeader>
              <TableRow className="data-table-head-row">
                <TableHead
                  className={cn(
                    "data-table-th data-table-sticky-flag sticky left-0 z-30 min-w-[200px] border-r border-border ps-5 transition-shadow duration-200 ease-out",
                    stickyEdgeShadow && "shadow-[var(--surface-shadow-sticky)]",
                  )}
                >
                  Flag
                </TableHead>
                <TableHead
                  className="data-table-th text-center whitespace-normal"
                  title={primaryEnv.name}
                >
                  <span className="inline-block max-w-48 leading-tight">{primaryEnv.name}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((flag) => {
                const enabledCount = initialEnvironments.filter(
                  (e) => flag.states[e.slug],
                ).length;
                const envTotal = initialEnvironments.length;

                const on = flag.states[primaryEnv.slug] ?? false;
                const busy = toggleBusy === `${flag.key}:${primaryEnv.id}`;
                const dialogForThisCell =
                  confirmToggle?.flagKey === flag.key && confirmToggle.envId === primaryEnv.id;

                return (
                  <TableRow key={flag.key} className="group/flag data-table-body-row">
                    <TableCell
                      className={cn(
                        "data-table-sticky-flag sticky left-0 z-20 border-r border-border py-3 align-top transition-[box-shadow,background-color] duration-200 ease-out group-hover/flag:bg-muted ps-5",
                        stickyEdgeShadow && "shadow-[var(--surface-shadow-sticky)]",
                      )}
                    >
                      <Link
                        href={`/flags/${encodeURIComponent(flag.key)}`}
                        className="group/link block py-1"
                        title={
                          flag.description.trim()
                            ? `${flag.name} — ${flag.description.trim()}`
                            : undefined
                        }
                      >
                        <span className="data-table-primary-label group-hover/link:text-primary">
                          {flag.name}
                        </span>
                        <code className="data-table-mono-meta truncate">{flag.key}</code>
                        {flag.description.trim() ? (
                          <p className="mt-1.5 max-w-[20rem] line-clamp-2 text-[0.8125rem] leading-snug text-muted-foreground">
                            {flag.description.trim()}
                          </p>
                        ) : null}
                        {envTotal > 0 ? (
                          <p
                            className="mt-2 text-[0.6875rem] tabular-nums tracking-wide text-muted-foreground"
                            title={`Enabled in ${enabledCount} of ${envTotal} environments`}
                          >
                            <span className="font-medium text-foreground">
                              {enabledCount}/{envTotal}
                            </span>{" "}
                            <span className="text-muted-foreground">environments on</span>
                          </p>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      {isAdmin ? (
                        <div className="flex items-center justify-center gap-2">
                          {busy ? (
                            <Loader2
                              className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                              aria-hidden
                            />
                          ) : null}
                          <Switch
                            checked={on}
                            disabled={busy || dialogForThisCell}
                            onCheckedChange={(checked) => {
                              if (checked === on) return;
                              setConfirmToggle({
                                flagKey: flag.key,
                                flagName: flag.name,
                                envId: primaryEnv.id,
                                envName: primaryEnv.name,
                                currentEnabled: on,
                                nextEnabled: checked,
                              });
                            }}
                            aria-label={`${flag.name} in ${primaryEnv.name}, ${on ? "on" : "off"}. Confirm to change.`}
                          />
                        </div>
                      ) : (
                        <p
                          role="status"
                          className={cn(
                            "mx-auto text-sm font-medium",
                            on ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {on ? "Enabled" : "Disabled"}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <ConfirmFlagToggleDialog
        open={confirmToggle !== null}
        onOpenChange={(open) => {
          if (!open && !confirmBusy) setConfirmToggle(null);
        }}
        flagName={confirmToggle?.flagName ?? ""}
        flagKey={confirmToggle?.flagKey ?? ""}
        environmentName={confirmToggle?.envName ?? ""}
        currentEnabled={confirmToggle?.currentEnabled ?? false}
        nextEnabled={confirmToggle?.nextEnabled ?? false}
        confirmBusy={confirmBusy}
        onConfirm={async () => {
          if (!confirmToggle) return;
          setConfirmBusy(true);
          try {
            const ok = await performToggle(confirmToggle.flagKey, confirmToggle.envId);
            if (ok) setConfirmToggle(null);
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
