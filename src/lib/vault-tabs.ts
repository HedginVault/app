export const PUBLIC_VAULT_TABS = ["overview", "history"] as const;
export type PublicVaultTab = (typeof PUBLIC_VAULT_TABS)[number];

export const publicVaultTab = (value: string | null): PublicVaultTab =>
  PUBLIC_VAULT_TABS.includes(value as PublicVaultTab) ? (value as PublicVaultTab) : "overview";
