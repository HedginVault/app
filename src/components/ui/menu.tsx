"use client";

import { useState } from "react";
import { Popover } from "./popover";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Why the item is disabled; shown under the label. */
  reason?: string;
}

export function Menu({ items, label = "Actions" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md px-2 py-1 text-lg leading-none text-white/50 hover:bg-white/[0.06] hover:text-white/90"
        >
          ⋯
        </button>
      }
    >
      <ul role="menu" className="w-56">
        {items.map((item) => (
          <li key={item.label} role="none">
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:text-white/40 disabled:hover:bg-transparent"
            >
              {item.label}
              {item.disabled && item.reason && (
                <span className="mt-0.5 block text-[12px] text-muted">{item.reason}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
