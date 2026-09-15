"use client";

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
    />
  );
}
