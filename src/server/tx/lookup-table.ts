import "server-only";
import { type AddressLookupTableAccount, PublicKey } from "@solana/web3.js";
import { cached } from "../cache";
import { getConnection } from "../program";

const TTL_MS = 5 * 60_000;

/**
 * The protocol lookup table (programs, config, treasury, common mints and vault accounts), created and
 * topped up by `scripts/protocol-lookup-table.mjs`. Builders merge it with Jupiter's route tables.
 * Unset or inactive yields none, so transactions still build, only larger.
 */
export const getProtocolLookupTables = (): Promise<AddressLookupTableAccount[]> =>
  cached("protocol-lookup-table", TTL_MS, async () => {
    const address = process.env.PROTOCOL_LOOKUP_TABLE?.trim();
    if (!address) return [];
    const { value } = await getConnection().getAddressLookupTable(new PublicKey(address));
    return value?.isActive() ? [value] : [];
  });
