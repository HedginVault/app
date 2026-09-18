import { cn } from "@/lib/cn";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} />
);
