import { WalletButton } from "@/components/wallet-button";
import { VaultList } from "@/components/vault-list";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <span className="font-semibold tracking-tight">Hedge Vault</span>
          <WalletButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Vaults</h1>
        <VaultList />
      </main>
    </div>
  );
}
