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
    <Image
      src="/logo.png"
      alt="Hedgin"
      width={2172}
      height={724}
      priority={priority}
      className={cn(
        "h-auto w-auto object-contain",
        isFooter ? "max-h-7" : "max-h-9 sm:max-h-11",
        className,
      )}
    />
  );
}
