import idl from "@/idl/hedge_vault.json";

/** Publish the exact generated IDL consumed by this app for on-chain integrations. */
export function GET(): Response {
  return Response.json(idl, { headers: { "cache-control": "public, max-age=300" } });
}
