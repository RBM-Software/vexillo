"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmFlagToggleDialog } from "@/components/confirm-flag-toggle-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FlagRolloutRow = {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
};

export default function FlagDetailClient({
  flagKey,
  initialFlag,
  initialRollout,
  isAdmin,
}: {
  flagKey: string;
  initialFlag: {
    id: string;
    name: string;
    key: string;
    description: string;
  };
  initialRollout: FlagRolloutRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialFlag.name);
  const [description, setDescription] = React.useState(initialFlag.description);
  const [rollout, setRollout] = React.useState(initialRollout);
  const [savingMeta, setSavingMeta] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [toggleBusy, setToggleBusy] = React.useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = React.useState<null | {
    envId: string;
    envName: string;
    currentEnabled: boolean;
    nextEnabled: boolean;
  }>(null);
  const [confirmBusy, setConfirmBusy] = React.useState(false);

  React.useEffect(() => {
    setName(initialFlag.name);
    setDescription(initialFlag.description);
  }, [initialFlag]);

  React.useEffect(() => {
    setRollout(initialRollout);
  }, [initialRollout]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/flags/${encodeURIComponent(flagKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail =
          typeof err.error === "string"
            ? err.error
            : `Could not save (${res.status}). Try again.`;
        toast.error(detail);
        return;
      }
      toast.success("Changes saved");
      router.refresh();
    } finally {
      setSavingMeta(false);
    }
  }

  async function performToggle(environmentId: string): Promise<boolean> {
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
      setRollout((prev) =>
        prev.map((r) => (r.id === environmentId ? { ...r, enabled } : r)),
      );
      return true;
    } finally {
      setToggleBusy(null);
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/flags/${encodeURIComponent(flagKey)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail =
          typeof err.error === "string"
            ? err.error
            : `Could not delete (${res.status}). Try again.`;
        toast.error(detail);
        return;
      }
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  const rolloutTable = (
    <Card className="surface-card page-enter page-enter-delay-2 mb-8">
      <CardContent className="pt-6">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-foreground">All environments</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Compare and change this flag in every environment.
          </p>
        </div>
        {rollout.length === 0 ? (
          <p className="text-sm text-muted-foreground">No environments configured yet.</p>
        ) : (
          <Table className="data-table">
            <TableHeader>
              <TableRow className="data-table-head-row">
                <TableHead className="data-table-th">Environment</TableHead>
                <TableHead className="data-table-th text-end">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rollout.map((row) => {
                const busy = toggleBusy === `${flagKey}:${row.id}`;
                const dialogForThisRow =
                  confirmToggle !== null && confirmToggle.envId === row.id;

                return (
                  <TableRow key={row.id} className="data-table-body-row">
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-end">
                      {isAdmin ? (
                        <div className="flex justify-end">
                          <Switch
                            checked={row.enabled}
                            disabled={busy || dialogForThisRow}
                            onCheckedChange={(checked) => {
                              if (checked === row.enabled) return;
                              setConfirmToggle({
                                envId: row.id,
                                envName: row.name,
                                currentEnabled: row.enabled,
                                nextEnabled: checked,
                              });
                            }}
                            aria-label={`${initialFlag.name} in ${row.name}, ${row.enabled ? "on" : "off"}`}
                          />
                        </div>
                      ) : (
                        <Badge
                          variant={row.enabled ? "default" : "secondary"}
                          className="rounded-lg px-2.5 font-mono text-[0.65rem] tracking-wide"
                        >
                          {row.enabled ? "ON" : "OFF"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="page-container page-container-narrow flex flex-1 flex-col pb-16">
      <div className="page-enter mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All flags
        </Link>
      </div>

      {isAdmin ? (
        <>
          <Card className="surface-card page-enter page-enter-delay-1 mb-8">
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="detail-name">Name</Label>
                <Input
                  id="detail-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-auto py-2 font-heading text-[1.625rem] font-normal tracking-[-0.02em] md:text-[1.875rem]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Key</Label>
                <code className="block font-mono text-sm text-foreground">{initialFlag.key}</code>
                <p className="text-xs text-muted-foreground">The key cannot be changed.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-desc">Description</Label>
                <Textarea
                  id="detail-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button type="button" disabled={savingMeta} onClick={() => void saveMeta()}>
                {savingMeta ? "Saving…" : "Save changes"}
              </Button>

              <div className="border-t border-border pt-6">
                <h2 className="text-sm font-medium text-destructive">Delete flag</h2>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-4 gap-2"
                  disabled={deleteBusy}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete flag
                </Button>
              </div>
            </CardContent>
          </Card>

          {rolloutTable}

          <Dialog open={deleteOpen} onOpenChange={(o) => !deleteBusy && setDeleteOpen(o)}>
            <DialogContent showCloseButton className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete this flag everywhere?</DialogTitle>
                <DialogDescription className="text-pretty">
                  This removes <strong className="text-foreground">{initialFlag.name}</strong> and its
                  values for every environment. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteBusy}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteBusy}
                  onClick={() => void confirmDelete()}
                >
                  {deleteBusy ? "Deleting…" : "Delete flag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmFlagToggleDialog
            open={confirmToggle !== null}
            onOpenChange={(open) => {
              if (!open && !confirmBusy) setConfirmToggle(null);
            }}
            flagName={initialFlag.name}
            flagKey={initialFlag.key}
            environmentName={confirmToggle?.envName ?? ""}
            currentEnabled={confirmToggle?.currentEnabled ?? false}
            nextEnabled={confirmToggle?.nextEnabled ?? false}
            confirmBusy={confirmBusy}
            onConfirm={async () => {
              if (!confirmToggle) return;
              setConfirmBusy(true);
              try {
                const ok = await performToggle(confirmToggle.envId);
                if (ok) setConfirmToggle(null);
              } finally {
                setConfirmBusy(false);
              }
            }}
          />
        </>
      ) : (
        <>
          <header className="page-enter page-enter-delay-1 mb-8">
            <h1 className="page-title">{initialFlag.name}</h1>
            <code className="mt-2 block font-mono text-sm text-muted-foreground">{initialFlag.key}</code>
          </header>
          <div className="surface-card page-enter page-enter-delay-2 mb-8 px-6 py-5">
            <p className="text-sm text-muted-foreground">{initialFlag.description || "No description."}</p>
          </div>
          {rolloutTable}
        </>
      )}
    </div>
  );
}
