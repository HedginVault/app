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
          className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800"
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
              className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
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
