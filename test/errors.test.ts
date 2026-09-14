import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, decodeAnchorError, errorFromUnknown, errorResponse, redact } from "@/server/errors";

describe("decodeAnchorError", () => {
  it("decodes an anchor error log line", () => {
    const logs = [
      "Program log: Instruction: DepositRequestCreate",
      "Program log: AnchorError occurred. Error Code: DepositBelowMinimum. Error Number: 6040. Error Message: Deposit is below the vault minimum.",
    ];
    expect(decodeAnchorError(logs)).toEqual({ code: "DepositBelowMinimum", message: "Deposit is below the vault minimum" });
  });
  it("decodes a custom program error hex code", () => {
    const logs = ["Program r2ahBQ6gbPCJ9FxBymYcXuwXi8NmenRry7SE7QR7FAt failed: custom program error: 0x1798"];
    expect(decodeAnchorError(logs)).toEqual({ code: "DepositBelowMinimum", message: "Deposit is below the vault minimum" });
  });
  it("returns null for unknown logs", () => {
    expect(decodeAnchorError(["Program log: hello"])).toBeNull();
  });
});

describe("errorFromUnknown", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("passes ApiError through and wraps others", () => {
    const e = new ApiError(403, "Forbidden", "nope");
    expect(errorFromUnknown(e)).toBe(e);
    const w = errorFromUnknown(new Error("fetch failed"));
    expect(w.status).toBe(503);
    expect(w.code).toBe("RpcUnavailable");
    const r = errorFromUnknown(new Error("429 Too Many Requests: max usage reached"));
    expect(r.code).toBe("RpcUnavailable");
    const u = errorFromUnknown(new Error("boom"));
    expect(u.status).toBe(500);
    expect(u.code).toBe("Internal");
    expect(u.message).toBe("Internal error");
  });
});

describe("errorFromUnknown network classification", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("turns a node-fetch DNS failure into 503 and never echoes the endpoint or its api key", async () => {
    const e = new Error(
      "request to https://rpc.example.com/?api-key=SECRET failed, reason: getaddrinfo ENOTFOUND rpc.example.com",
    );
    const api = errorFromUnknown(e);
    expect(api.status).toBe(503);
    expect(api.code).toBe("RpcUnavailable");
    const body = JSON.stringify(await errorResponse(e).json());
    expect(body).not.toContain("SECRET");
    expect(body).not.toContain("rpc.example.com");
  });

  it("classifies FetchError / TypeError by name even when the message says nothing", () => {
    const fetchError = Object.assign(new Error("something went wrong"), { name: "FetchError" });
    expect(errorFromUnknown(fetchError).status).toBe(503);
    expect(errorFromUnknown(new TypeError("failed")).status).toBe(503);
  });

  it("returns a fixed message for a 500 rather than the raw error", async () => {
    const e = new Error("boom with https://rpc.example.com/?api-key=SECRET");
    const api = errorFromUnknown(e);
    expect(api.status).toBe(500);
    expect(api.message).toBe("Internal error");
    const body = await errorResponse(e).json();
    expect(body.error).toEqual({ code: "Internal", message: "Internal error" });
  });
});

describe("redact", () => {
  it("removes the configured endpoint and any api-key query value", () => {
    expect(redact("connect https://rpc.example.com/?api-key=SECRET now", "https://rpc.example.com/")).toBe(
      "connect <redacted>?api-key=<redacted> now",
    );
    expect(redact("apikey=abc123&x=1", "")).toBe("apikey=<redacted>&x=1");
  });
});
