import type { Status } from "@/lib/types";
import { Badge } from "./badge";

const map: Record<Status, { label: string; tone: "accent" | "warning" | "danger" }> = {
  normal: { label: "Active", tone: "accent" },
  reduceOnly: { label: "Reduce only", tone: "warning" },
  paused: { label: "Paused", tone: "danger" },
};

export const StatusBadge = ({ status }: { status: Status }) => (
  <Badge tone={map[status].tone}>{map[status].label}</Badge>
);
