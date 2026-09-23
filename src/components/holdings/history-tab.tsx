import { StrategyHistory } from "./strategy-history";

/** Closed-position history shared by public and manager vault surfaces. */
export function HistoryTab({ address }: { address: string }) {
  return <StrategyHistory address={address} />;
}
