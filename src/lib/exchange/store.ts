import { randomBytes, randomUUID } from "node:crypto";

import {
  DEPOSIT_ADDRESSES,
  type DepositRequest,
  type ExchangeEvent,
  type ExchangeTransaction,
  type ServerRouteSnapshot,
  type WithdrawalRequest,
} from "./types";

type Listener = (event: ExchangeEvent) => void;

interface MockExchangeStore {
  transactions: Map<string, ExchangeTransaction>;
  listeners: Set<Listener>;
  sequence: number;
}

const now = Date.now();
const seedTransactions: ExchangeTransaction[] = [
  {
    id: "DP-84271",
    kind: "deposit",
    rail: "onchain",
    asset: "USDT",
    amount: 2500,
    status: "completed",
    statusDetail: "3/3 确认，已入账",
    counterparty: DEPOSIT_ADDRESSES.TRON,
    network: "TRON",
    txHash: "9b8134e0a23d6410d6f97728b151da1cbcc73bbf7a58f68ce54b1db118ca2e17",
    confirmations: { current: 3, required: 3 },
    createdAt: new Date(now - 18 * 60_000).toISOString(),
    updatedAt: new Date(now - 16 * 60_000).toISOString(),
  },
  {
    id: "WD-19358",
    kind: "withdrawal",
    rail: "internal",
    asset: "ETH",
    amount: 0.42,
    status: "completed",
    statusDetail: "站内划转已完成",
    counterparty: "UID-761204",
    createdAt: new Date(now - 51 * 60_000).toISOString(),
    updatedAt: new Date(now - 50 * 60_000).toISOString(),
  },
];

const globalExchange = globalThis as typeof globalThis & {
  __exchangeWalletDemoStore?: MockExchangeStore;
};

const store =
  globalExchange.__exchangeWalletDemoStore ??
  {
    transactions: new Map(
      seedTransactions.map((transaction) => [transaction.id, transaction]),
    ),
    listeners: new Set<Listener>(),
    sequence: 0,
  };

globalExchange.__exchangeWalletDemoStore = store;

function copyTransaction(transaction: ExchangeTransaction) {
  return {
    ...transaction,
    confirmations: transaction.confirmations
      ? { ...transaction.confirmations }
      : undefined,
  };
}

function nextEventId() {
  store.sequence += 1;
  return `${Date.now()}-${store.sequence}`;
}

function publish(
  type: "transaction.created" | "transaction.updated",
  transaction: ExchangeTransaction,
) {
  const event: ExchangeEvent = {
    id: nextEventId(),
    type,
    at: new Date().toISOString(),
    transaction: copyTransaction(transaction),
  };

  for (const listener of store.listeners) {
    listener(event);
  }
}

function createTransactionId(kind: "deposit" | "withdrawal") {
  const prefix = kind === "deposit" ? "DP" : "WD";
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createMockHash() {
  return randomBytes(32).toString("hex");
}

function saveTransaction(transaction: ExchangeTransaction) {
  store.transactions.set(transaction.id, transaction);

  if (store.transactions.size > 40) {
    const oldest = [...store.transactions.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )[0];
    if (oldest) store.transactions.delete(oldest.id);
  }

  publish("transaction.created", transaction);
  return copyTransaction(transaction);
}

function updateTransaction(
  id: string,
  patch: Partial<ExchangeTransaction>,
) {
  const current = store.transactions.get(id);
  if (!current) return;

  const updated: ExchangeTransaction = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.transactions.set(id, updated);
  publish("transaction.updated", updated);
}

function scheduleUpdate(
  id: string,
  delay: number,
  patch: Partial<ExchangeTransaction>,
) {
  setTimeout(() => updateTransaction(id, patch), delay);
}

export function createDeposit(input: DepositRequest) {
  const timestamp = new Date().toISOString();
  const transaction: ExchangeTransaction = {
    id: createTransactionId("deposit"),
    kind: "deposit",
    rail: input.rail,
    asset: input.asset,
    amount: input.amount,
    status: "pending",
    statusDetail:
      input.rail === "internal" ? "正在核对付款 UID" : "等待链上确认",
    counterparty:
      input.rail === "internal"
        ? input.sourceUid!
        : DEPOSIT_ADDRESSES[input.network!],
    network: input.network,
    txHash: input.rail === "onchain" ? createMockHash() : undefined,
    confirmations:
      input.rail === "onchain" ? { current: 0, required: 3 } : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const saved = saveTransaction(transaction);

  if (input.rail === "internal") {
    scheduleUpdate(transaction.id, 650, {
      status: "processing",
      statusDetail: "站内划转处理中",
    });
    scheduleUpdate(transaction.id, 1_600, {
      status: "completed",
      statusDetail: "站内资产已入账",
    });
  } else {
    scheduleUpdate(transaction.id, 700, {
      status: "confirming",
      statusDetail: "1/3 链上确认",
      confirmations: { current: 1, required: 3 },
    });
    scheduleUpdate(transaction.id, 1_500, {
      status: "confirming",
      statusDetail: "2/3 链上确认",
      confirmations: { current: 2, required: 3 },
    });
    scheduleUpdate(transaction.id, 2_400, {
      status: "completed",
      statusDetail: "3/3 确认，已入账",
      confirmations: { current: 3, required: 3 },
    });
  }

  return saved;
}

export function createWithdrawal(input: WithdrawalRequest) {
  const timestamp = new Date().toISOString();
  const transaction: ExchangeTransaction = {
    id: createTransactionId("withdrawal"),
    kind: "withdrawal",
    rail: input.rail,
    asset: input.asset,
    amount: input.amount,
    status: "reviewing",
    statusDetail: "三重安全验证已通过",
    counterparty:
      input.rail === "internal" ? input.recipientUid! : input.address!,
    network: input.network,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const saved = saveTransaction(transaction);

  scheduleUpdate(transaction.id, 700, {
    status: "processing",
    statusDetail:
      input.rail === "internal" ? "站内划转处理中" : "已广播至链上网络",
    txHash: input.rail === "onchain" ? createMockHash() : undefined,
  });
  scheduleUpdate(transaction.id, input.rail === "internal" ? 1_700 : 2_600, {
    status: "completed",
    statusDetail:
      input.rail === "internal" ? "站内划转已完成" : "链上提取已完成",
  });

  return saved;
}

export function listTransactions() {
  return [...store.transactions.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(copyTransaction);
}

export function createServerRouteSnapshot(): ServerRouteSnapshot {
  const transactions = listTransactions();
  const completedCount = transactions.filter(
    (transaction) => transaction.status === "completed",
  ).length;

  return {
    renderId: randomUUID().slice(0, 6).toUpperCase(),
    renderedAt: new Date().toISOString(),
    transactionCount: transactions.length,
    activeCount: transactions.length - completedCount,
    completedCount,
  };
}

export function createSnapshotEvent(): ExchangeEvent {
  return {
    id: nextEventId(),
    type: "snapshot",
    at: new Date().toISOString(),
    transactions: listTransactions(),
  };
}

export function subscribe(listener: Listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}
