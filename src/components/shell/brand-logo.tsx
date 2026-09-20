import Image from "next/image";
import { cn } from "@/lib/cn";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  size?: "header" | "footer";
};

export function BrandLogo({ className, priority = false, size = "header" }: BrandLogoProps) {
  const isFooter = size === "footer";

  return (
    <span
      className={cn(
        "relative block overflow-hidden",
        isFooter ? "h-7 w-24" : "h-9 w-32 sm:h-11 sm:w-40",
        className,
      )}
    >
      <Image
        src="/logo.png"
        alt="Hedgin"
        width={2172}
        height={724}
        priority={priority}
        className={cn(
          "absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2",
          isFooter
            ? "h-[3.25rem] w-[9.75rem]"
            : "h-[4.125rem] w-[12.375rem] sm:h-[5.25rem] sm:w-[15.75rem]",
        )}
      />
    </span>
  );
}
