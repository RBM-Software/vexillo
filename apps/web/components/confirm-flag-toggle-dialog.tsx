"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function stateLabel(on: boolean) {
  return on ? "On" : "Off";
}

export function ConfirmFlagToggleDialog({
  open,
  onOpenChange,
  flagName,
  flagKey,
  environmentName,
  currentEnabled,
  nextEnabled,
  confirmBusy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flagName: string;
  flagKey: string;
  environmentName: string;
  currentEnabled: boolean;
  nextEnabled: boolean;
  confirmBusy: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-pretty">
            This will change the flag in{" "}
            <span className="text-foreground">{environmentName}</span>.
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirm enabling or disabling this flag for {environmentName}.
          </DialogDescription>
          <div className="space-y-4 pt-1 text-sm text-muted-foreground">
              <ul className="list-none space-y-3 pl-0">
                <li>
                  <span className="font-medium text-foreground">Flag</span>
                  <div className="mt-0.5 font-medium text-foreground">{flagName}</div>
                  <code className="mt-1 block font-mono text-xs text-muted-foreground">{flagKey}</code>
                </li>
                <li>
                  <span className="font-medium text-foreground">Effective value after change</span>
                  <div className="mt-0.5">{stateLabel(nextEnabled)}</div>
                </li>
                <li>
                  <span className="font-medium text-foreground">Blast radius</span>
                  <div className="mt-0.5 text-pretty">
                    Applies to all traffic in <strong className="text-foreground">{environmentName}</strong> once
                    your SDK picks up the latest configuration.
                  </div>
                </li>
                <li>
                  <span className="font-medium text-foreground">Change</span>
                  <div className="mt-0.5 tabular-nums">
                    {stateLabel(currentEnabled)} → {stateLabel(nextEnabled)}
                  </div>
                </li>
                <li>
                  <span className="font-medium text-foreground">Undo</span>
                  <div className="mt-0.5 text-pretty">You can revert this anytime from the same control.</div>
                </li>
              </ul>
          </div>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={confirmBusy} />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={confirmBusy}
            onClick={() => {
              void Promise.resolve(onConfirm()).catch(() => {});
            }}
          >
            {confirmBusy ? "Saving…" : "Confirm change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
