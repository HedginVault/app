import { NavChart } from "./nav-chart";
import { StrategyHistory } from "./strategy-history";

/** Shared historical view for public and manager vault surfaces. */
export function HistoryTab({ address, depositSymbol }: { address: string; depositSymbol: string }) {
  return (
    <div className="space-y-6">
      <NavChart address={address} depositSymbol={depositSymbol} />
      <StrategyHistory address={address} />
    </div>
  );
}
