import { describe, expect, it } from "vitest";

import { MOCK_CODES } from "./types";
import {
  validateDepositRequest,
  validateWithdrawalRequest,
} from "./validation";

describe("validateDepositRequest", () => {
  it("accepts a valid internal UID deposit", () => {
    expect(
      validateDepositRequest({
        rail: "internal",
        asset: "USDT",
        amount: 25,
        sourceUid: "UID-580219",
      }),
    ).toEqual({
      ok: true,
      data: {
        rail: "internal",
        asset: "USDT",
        amount: 25,
        sourceUid: "UID-580219",
      },
    });
  });

  it("accepts a supported on-chain deposit", () => {
    expect(
      validateDepositRequest({
        rail: "onchain",
        asset: "BTC",
        amount: "0.01",
        network: "BITCOIN",
      }),
    ).toEqual({
      ok: true,
      data: {
        rail: "onchain",
        asset: "BTC",
        amount: 0.01,
        network: "BITCOIN",
      },
    });
  });

  it("rejects an asset and network mismatch", () => {
    expect(
      validateDepositRequest({
        rail: "onchain",
        asset: "BTC",
        amount: 0.01,
        network: "TRON",
      }),
    ).toEqual({ ok: false, error: "该币种不支持所选网络。" });
  });

  it("rejects a non-positive amount", () => {
    expect(
      validateDepositRequest({
        rail: "internal",
        asset: "ETH",
        amount: 0,
        sourceUid: "UID-580219",
      }).ok,
    ).toBe(false);
  });
});

describe("validateWithdrawalRequest", () => {
  const verification = { ...MOCK_CODES };

  it("requires and accepts all three mock security codes", () => {
    expect(
      validateWithdrawalRequest({
        rail: "internal",
        asset: "ETH",
        amount: 0.42,
        recipientUid: "UID-761204",
        ...verification,
      }),
    ).toEqual({
      ok: true,
      data: {
        rail: "internal",
        asset: "ETH",
        amount: 0.42,
        recipientUid: "UID-761204",
        ...verification,
      },
    });
  });

  it("rejects an incorrect authenticator code", () => {
    expect(
      validateWithdrawalRequest({
        rail: "internal",
        asset: "USDT",
        amount: 10,
        recipientUid: "UID-761204",
        ...verification,
        authenticatorCode: "000000",
      }),
    ).toEqual({ ok: false, error: "Mock 验证码不正确。" });
  });

  it("accepts a valid on-chain withdrawal", () => {
    const result = validateWithdrawalRequest({
      rail: "onchain",
      asset: "USDT",
      amount: 120.5,
      network: "TRON",
      address: "TVnD3moReceiver9Qx8K2pL5sW7yA4cB6",
      ...verification,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.address).toBe(
        "TVnD3moReceiver9Qx8K2pL5sW7yA4cB6",
      );
    }
  });

  it("rejects a malformed on-chain address", () => {
    expect(
      validateWithdrawalRequest({
        rail: "onchain",
        asset: "USDT",
        amount: 120.5,
        network: "TRON",
        address: "bad address",
        ...verification,
      }).ok,
    ).toBe(false);
  });
});
