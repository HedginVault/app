// Browser-safe mirror of utils/pda.ts (no Node `Buffer` global).
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { HEDGE_VAULT_PROGRAM_ID } from "./constants";

const utf8 = (s: string) => new TextEncoder().encode(s);

const find = (seeds: Uint8Array[]) =>
  PublicKey.findProgramAddressSync(seeds, HEDGE_VAULT_PROGRAM_ID)[0];

export const getConfigPda = () => find([utf8("config")]);

export const getManagerPda = (authority: PublicKey) =>
  find([utf8("manager"), authority.toBytes()]);

export const getVaultPda = (id: BN | number) =>
  find([utf8("vault"), new Uint8Array(new BN(id).toArray("le", 8))]);

export const getShareMintPda = (vault: PublicKey) =>
  find([utf8("share_mint"), vault.toBytes()]);

export const getDepositEscrowPda = (vault: PublicKey) =>
  find([utf8("deposit_escrow"), vault.toBytes()]);

export const getShareEscrowPda = (vault: PublicKey) =>
  find([utf8("share_escrow"), vault.toBytes()]);

export const getStrategyPda = (vault: PublicKey, protocolAccount: PublicKey) =>
  find([utf8("strategy"), vault.toBytes(), protocolAccount.toBytes()]);

export const getDepositRequestPda = (vault: PublicKey, authority: PublicKey) =>
  find([utf8("deposit_request"), vault.toBytes(), authority.toBytes()]);

export const getWithdrawalRequestPda = (vault: PublicKey, authority: PublicKey) =>
  find([utf8("withdrawal_request"), vault.toBytes(), authority.toBytes()]);
