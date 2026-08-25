import {
  ASSETS,
  MOCK_CODES,
  NETWORK_OPTIONS,
  type Asset,
  type DepositRequest,
  type Network,
  type Rail,
  type WithdrawalRequest,
} from "./types";

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const UID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{3,19}$/;
const CODE_PATTERN = /^\d{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRail(value: unknown): Rail | null {
  return value === "internal" || value === "onchain" ? value : null;
}

function readAsset(value: unknown): Asset | null {
  return typeof value === "string" && ASSETS.includes(value as Asset)
    ? (value as Asset)
    : null;
}

function readNetwork(value: unknown): Network | null {
  return typeof value === "string" &&
    NETWORK_OPTIONS.some((network) => network.value === value)
    ? (value as Network)
    : null;
}

function readAmount(value: unknown): number | null {
  const amount = typeof value === "string" ? Number(value) : value;

  return typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1_000_000
    ? amount
    : null;
}

function supportsAsset(network: Network, asset: Asset) {
  const option = NETWORK_OPTIONS.find((item) => item.value === network);
  return option?.assets.some((item) => item === asset) ?? false;
}

export function validateDepositRequest(
  value: unknown,
): ValidationResult<DepositRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "请提交有效的充值信息。" };
  }

  const rail = readRail(value.rail);
  const asset = readAsset(value.asset);
  const amount = readAmount(value.amount);

  if (!rail || !asset || amount === null) {
    return { ok: false, error: "充值方式、币种或金额无效。" };
  }

  if (rail === "internal") {
    const sourceUid =
      typeof value.sourceUid === "string" ? value.sourceUid.trim() : "";

    if (!UID_PATTERN.test(sourceUid)) {
      return { ok: false, error: "请输入 4–20 位有效付款 UID。" };
    }

    return { ok: true, data: { rail, asset, amount, sourceUid } };
  }

  const network = readNetwork(value.network);
  if (!network || !supportsAsset(network, asset)) {
    return { ok: false, error: "该币种不支持所选网络。" };
  }

  return { ok: true, data: { rail, asset, amount, network } };
}

export function validateWithdrawalRequest(
  value: unknown,
): ValidationResult<WithdrawalRequest> {
  if (!isRecord(value)) {
    return { ok: false, error: "请提交有效的提取信息。" };
  }

  const rail = readRail(value.rail);
  const asset = readAsset(value.asset);
  const amount = readAmount(value.amount);

  if (!rail || !asset || amount === null) {
    return { ok: false, error: "提取方式、币种或金额无效。" };
  }

  const phoneCode =
    typeof value.phoneCode === "string" ? value.phoneCode.trim() : "";
  const emailCode =
    typeof value.emailCode === "string" ? value.emailCode.trim() : "";
  const authenticatorCode =
    typeof value.authenticatorCode === "string"
      ? value.authenticatorCode.trim()
      : "";

  if (
    !CODE_PATTERN.test(phoneCode) ||
    !CODE_PATTERN.test(emailCode) ||
    !CODE_PATTERN.test(authenticatorCode)
  ) {
    return { ok: false, error: "所有安全验证码都必须是 6 位数字。" };
  }

  if (
    phoneCode !== MOCK_CODES.phoneCode ||
    emailCode !== MOCK_CODES.emailCode ||
    authenticatorCode !== MOCK_CODES.authenticatorCode
  ) {
    return { ok: false, error: "Mock 验证码不正确。" };
  }

  if (rail === "internal") {
    const recipientUid =
      typeof value.recipientUid === "string"
        ? value.recipientUid.trim()
        : "";

    if (!UID_PATTERN.test(recipientUid)) {
      return { ok: false, error: "请输入 4–20 位有效收款 UID。" };
    }

    return {
      ok: true,
      data: {
        rail,
        asset,
        amount,
        recipientUid,
        phoneCode,
        emailCode,
        authenticatorCode,
      },
    };
  }

  const network = readNetwork(value.network);
  const address = typeof value.address === "string" ? value.address.trim() : "";

  if (!network || !supportsAsset(network, asset)) {
    return { ok: false, error: "该币种不支持所选网络。" };
  }

  if (address.length < 10 || address.length > 128 || /\s/.test(address)) {
    return { ok: false, error: "请输入有效的链上收款地址。" };
  }

  return {
    ok: true,
    data: {
      rail,
      asset,
      amount,
      network,
      address,
      phoneCode,
      emailCode,
      authenticatorCode,
    },
  };
}
