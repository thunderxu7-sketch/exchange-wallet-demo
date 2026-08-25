export const ASSETS = ["USDT", "BTC", "ETH"] as const;

export type Asset = (typeof ASSETS)[number];
export type Rail = "internal" | "onchain";
export type TransactionKind = "deposit" | "withdrawal";
export type TransactionStatus =
  | "pending"
  | "confirming"
  | "reviewing"
  | "processing"
  | "completed";

export const NETWORK_OPTIONS = [
  { value: "TRON", label: "TRON (TRC20)", assets: ["USDT"] },
  { value: "ETHEREUM", label: "Ethereum (ERC20)", assets: ["USDT", "ETH"] },
  { value: "BITCOIN", label: "Bitcoin", assets: ["BTC"] },
] as const;

export type Network = (typeof NETWORK_OPTIONS)[number]["value"];

export const DEPOSIT_ADDRESSES: Record<Network, string> = {
  TRON: "TVault7Demo5Qk2mN8xP3rS9uW4yZ6aB",
  ETHEREUM: "0x7D3e91F28C4b5A6dE8f9012C3B4A56789D0E1F2A",
  BITCOIN: "bc1qvault7demo4x8p2k6m9n3s5w7y0za2c4v6b",
};

export const MOCK_CODES = {
  phoneCode: "123456",
  emailCode: "234567",
  authenticatorCode: "345678",
} as const;

export interface DepositRequest {
  rail: Rail;
  asset: Asset;
  amount: number;
  sourceUid?: string;
  network?: Network;
}

export interface WithdrawalRequest {
  rail: Rail;
  asset: Asset;
  amount: number;
  recipientUid?: string;
  network?: Network;
  address?: string;
  phoneCode: string;
  emailCode: string;
  authenticatorCode: string;
}

export interface ExchangeTransaction {
  id: string;
  kind: TransactionKind;
  rail: Rail;
  asset: Asset;
  amount: number;
  status: TransactionStatus;
  statusDetail: string;
  counterparty: string;
  network?: Network;
  txHash?: string;
  confirmations?: {
    current: number;
    required: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type ExchangeEvent =
  | {
      id: string;
      type: "snapshot";
      at: string;
      transactions: ExchangeTransaction[];
    }
  | {
      id: string;
      type: "transaction.created" | "transaction.updated";
      at: string;
      transaction: ExchangeTransaction;
    };
