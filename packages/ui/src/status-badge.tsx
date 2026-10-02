import { clsx } from "clsx";

import type { DeviceStatus } from "@wifi-control/shared";
import type { JSX } from "react";

interface StatusBadgeProps {
  status: DeviceStatus;
}

const statusClassName: Record<DeviceStatus, string> = {
  offline: "border-zinc-300 bg-zinc-50 text-zinc-600",
  online: "border-emerald-300 bg-emerald-50 text-emerald-700",
  unknown: "border-amber-300 bg-amber-50 text-amber-700"
};

const statusLabel: Record<DeviceStatus, string> = {
  offline: "Offline",
  online: "Online",
  unknown: "Unknown"
};

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-1 text-xs font-medium",
        "border",
        statusClassName[status]
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
