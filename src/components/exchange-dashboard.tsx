"use client";

import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./exchange-dashboard.module.css";
import {
  ASSETS,
  DEPOSIT_ADDRESSES,
  MOCK_CODES,
  NETWORK_OPTIONS,
  type Asset,
  type ExchangeEvent,
  type ExchangeTransaction,
  type Network,
  type Rail,
  type TransactionStatus,
} from "@/lib/exchange/types";

type Operation = "deposit" | "withdrawal";
type StreamState = "connecting" | "live" | "reconnecting";
type Notice = { kind: "success" | "error" | "info"; message: string };
type SecurityCodeKey = keyof typeof MOCK_CODES;

const BALANCES: Record<
  Asset,
  { amount: string; fiat: string; accent: string }
> = {
  USDT: { amount: "12,840.50", fiat: "¥ 91,352.42", accent: "#12b981" },
  BTC: { amount: "0.1842", fiat: "¥ 147,905.80", accent: "#f59f23" },
  ETH: { amount: "4.6800", fiat: "¥ 105,846.15", accent: "#687cf7" },
};

const STATUS_META: Record<
  TransactionStatus,
  { label: string; tone: "waiting" | "active" | "done" }
> = {
  pending: { label: "待处理", tone: "waiting" },
  confirming: { label: "确认中", tone: "active" },
  reviewing: { label: "审核中", tone: "waiting" },
  processing: { label: "处理中", tone: "active" },
  completed: { label: "已完成", tone: "done" },
};

function Icon({
  name,
  size = 20,
  className,
}: {
  name:
    | "arrowDown"
    | "arrowUp"
    | "bolt"
    | "check"
    | "chevron"
    | "copy"
    | "globe"
    | "help"
    | "id"
    | "lock"
    | "mail"
    | "phone"
    | "shield"
    | "spark"
    | "wallet";
  size?: number;
  className?: string;
}) {
  const paths: Record<typeof name, ReactNode> = {
    arrowDown: (
      <>
        <path d="M12 3v14" />
        <path d="m7 12 5 5 5-5" />
      </>
    ),
    arrowUp: (
      <>
        <path d="M12 21V7" />
        <path d="m7 12 5-5 5 5" />
      </>
    ),
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    copy: (
      <>
        <rect width="13" height="13" x="9" y="9" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9a2.5 2.5 0 1 1 3.2 2.4c-.9.3-.9 1-.9 1.6M12 17h.01" />
      </>
    ),
    id: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="11" r="2" />
        <path d="M6 16c.7-1.5 1.5-2 2.5-2s1.8.5 2.5 2M14 10h4M14 14h3" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    phone: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 5h4M11.5 18h1" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4.5 6v5.2c0 4.6 3 8.4 7.5 9.8 4.5-1.4 7.5-5.2 7.5-9.8V6L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="m6 14 .8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14Z" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6.5V5a2 2 0 0 1 2-2h12" />
        <rect x="3" y="6" width="18" height="15" rx="3" />
        <path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function networksForAsset(asset: Asset) {
  return NETWORK_OPTIONS.filter((network) =>
    (network.assets as readonly string[]).includes(asset),
  );
}

function upsertTransaction(
  transactions: ExchangeTransaction[],
  transaction: ExchangeTransaction,
) {
  return [
    transaction,
    ...transactions.filter((item) => item.id !== transaction.id),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function formatAmount(transaction: ExchangeTransaction) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 8,
  }).format(transaction.amount);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function shortText(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

function VerificationField({
  icon,
  label,
  maskedTarget,
  codeKey,
  value,
  onChange,
  onFill,
}: {
  icon: "phone" | "mail" | "shield";
  label: string;
  maskedTarget: string;
  codeKey: SecurityCodeKey;
  value: string;
  onChange: (value: string) => void;
  onFill: (key: SecurityCodeKey) => void;
}) {
  return (
    <div className={styles.verificationRow}>
      <span className={styles.verificationIcon}>
        <Icon name={icon} size={18} />
      </span>
      <label className={styles.verificationLabel}>
        <span>{label}</span>
        <small>{maskedTarget}</small>
      </label>
      <input
        aria-label={`${label}验证码`}
        autoComplete="one-time-code"
        className={styles.codeInput}
        inputMode="numeric"
        maxLength={6}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        pattern="[0-9]{6}"
        placeholder="6 位验证码"
        required
        value={value}
      />
      <button
        className={styles.mockButton}
        onClick={() => onFill(codeKey)}
        type="button"
      >
        填入 Mock
      </button>
    </div>
  );
}

export default function ExchangeDashboard() {
  const [operation, setOperation] = useState<Operation>("deposit");
  const [rail, setRail] = useState<Rail>("internal");
  const [asset, setAsset] = useState<Asset>("USDT");
  const [network, setNetwork] = useState<Network>("TRON");
  const [transactions, setTransactions] = useState<ExchangeTransaction[]>([]);
  const [streamState, setStreamState] =
    useState<StreamState>("connecting");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  const [codes, setCodes] = useState({
    phoneCode: "",
    emailCode: "",
    authenticatorCode: "",
  });

  const availableNetworks = useMemo(() => networksForAsset(asset), [asset]);
  const activeNetwork = availableNetworks.some(
    (option) => option.value === network,
  )
    ? network
    : availableNetworks[0].value;
  const depositAddress = DEPOSIT_ADDRESSES[activeNetwork];

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onopen = () => setStreamState("live");
    source.onerror = () => setStreamState("reconnecting");
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as ExchangeEvent;
        if (event.type === "snapshot") {
          setTransactions(event.transactions);
        } else {
          setTransactions((current) =>
            upsertTransaction(current, event.transaction),
          );
        }
      } catch {
        // Ignore malformed demo events and let EventSource continue.
      }
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function submitRequest(
    endpoint: string,
    payload: Record<string, unknown>,
  ) {
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        transaction?: ExchangeTransaction;
      };

      if (!response.ok || !result.transaction) {
        throw new Error(result.error ?? "请求失败，请稍后重试。");
      }

      setTransactions((current) =>
        upsertTransaction(current, result.transaction!),
      );
      setNotice({
        kind: "success",
        message: `申请 ${result.transaction.id} 已提交，状态将通过 SSE 实时更新。`,
      });
      return true;
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "请求失败。",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const success = await submitRequest("/api/deposits", {
      rail,
      asset,
      amount: Number(data.get("amount")),
      sourceUid: data.get("sourceUid"),
      network: activeNetwork,
    });

    if (success) form.reset();
  }

  async function handleWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const success = await submitRequest("/api/withdrawals", {
      rail,
      asset,
      amount: Number(data.get("amount")),
      recipientUid: data.get("recipientUid"),
      network: activeNetwork,
      address: data.get("address"),
      ...codes,
    });

    if (success) {
      form.reset();
      setCodes({ phoneCode: "", emailCode: "", authenticatorCode: "" });
    }
  }

  function switchOperation(nextOperation: Operation) {
    setOperation(nextOperation);
    setNotice(null);
  }

  function updateCode(key: SecurityCodeKey, value: string) {
    setCodes((current) => ({ ...current, [key]: value }));
  }

  function fillMockCode(key: SecurityCodeKey) {
    updateCode(key, MOCK_CODES[key]);
    setNotice({ kind: "info", message: "Mock 验证码已填入。" });
  }

  async function copyDepositAddress() {
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setNotice({ kind: "error", message: "复制失败，请手动复制地址。" });
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <a className={styles.brand} href="#top" aria-label="Vault·X 资金账户首页">
            <span className={styles.brandMark}>
              <span />
              <span />
              <span />
            </span>
            <span>VAULT·X</span>
          </a>
          <nav className={styles.nav} aria-label="主导航">
            <a href="#overview">资产总览</a>
            <a className={styles.navActive} href="#funding">充值与提取</a>
            <a href="#activity">资金记录</a>
          </nav>
          <div className={styles.accountArea}>
            <span className={styles.demoBadge}>
              <span /> Demo environment
            </span>
            <button className={styles.helpButton} type="button" aria-label="帮助">
              <Icon name="help" size={19} />
            </button>
            <div className={styles.avatar}>TX</div>
          </div>
        </div>
      </header>

      <main className={styles.main} id="top">
        <section className={styles.hero} id="overview">
          <div>
            <p className={styles.eyebrow}>
              <Icon name="wallet" size={15} /> 资金账户
            </p>
            <h1>充值与提取</h1>
            <p>统一管理站内划转与链上资产，资金状态实时可见。</p>
          </div>
          <div className={styles.uidCard}>
            <span>我的 UID</span>
            <strong>UID-284901</strong>
            <button
              onClick={() => navigator.clipboard.writeText("UID-284901")}
              type="button"
              aria-label="复制 UID"
            >
              <Icon name="copy" size={15} />
            </button>
          </div>
        </section>

        <section className={styles.balanceGrid} aria-label="资产余额">
          {ASSETS.map((balanceAsset) => (
            <article className={styles.balanceCard} key={balanceAsset}>
              <div
                className={styles.assetToken}
                style={{ "--token-color": BALANCES[balanceAsset].accent } as CSSProperties}
              >
                {balanceAsset === "USDT" ? "₮" : balanceAsset.slice(0, 1)}
              </div>
              <div>
                <span>{balanceAsset} 可用</span>
                <strong>{BALANCES[balanceAsset].amount}</strong>
              </div>
              <small>{BALANCES[balanceAsset].fiat}</small>
            </article>
          ))}
        </section>

        <div className={styles.workspace} id="funding">
          <section className={styles.operationCard}>
            <div className={styles.operationTabs} role="tablist" aria-label="资金操作">
              <button
                aria-selected={operation === "deposit"}
                className={operation === "deposit" ? styles.activeOperation : ""}
                onClick={() => switchOperation("deposit")}
                role="tab"
                type="button"
              >
                <span className={styles.tabIcon}><Icon name="arrowDown" /></span>
                <span><strong>充值</strong><small>Deposit</small></span>
              </button>
              <button
                aria-selected={operation === "withdrawal"}
                className={operation === "withdrawal" ? styles.activeOperation : ""}
                onClick={() => switchOperation("withdrawal")}
                role="tab"
                type="button"
              >
                <span className={styles.tabIcon}><Icon name="arrowUp" /></span>
                <span><strong>提取</strong><small>Withdraw</small></span>
              </button>
            </div>

            <div className={styles.formBody}>
              <div className={styles.formHeading}>
                <div>
                  <span>01</span>
                  <div>
                    <h2>{operation === "deposit" ? "选择充值方式" : "选择提取方式"}</h2>
                    <p>{operation === "deposit" ? "资金转入当前账户" : "资金转出至指定账户"}</p>
                  </div>
                </div>
                <span className={styles.secureLabel}><Icon name="lock" size={14} /> 安全连接</span>
              </div>

              <div className={styles.railSelector}>
                <button
                  aria-pressed={rail === "internal"}
                  className={rail === "internal" ? styles.activeRail : ""}
                  onClick={() => setRail("internal")}
                  type="button"
                >
                  <span><Icon name="id" /></span>
                  <span><strong>站内 UID</strong><small>即时到账 · 0 手续费</small></span>
                  <Icon name="check" size={17} className={styles.railCheck} />
                </button>
                <button
                  aria-pressed={rail === "onchain"}
                  className={rail === "onchain" ? styles.activeRail : ""}
                  onClick={() => setRail("onchain")}
                  type="button"
                >
                  <span><Icon name="globe" /></span>
                  <span><strong>链上网络</strong><small>多链支持 · 实时确认</small></span>
                  <Icon name="check" size={17} className={styles.railCheck} />
                </button>
              </div>

              {operation === "deposit" ? (
                <form className={styles.form} onSubmit={handleDeposit}>
                  <div className={styles.formSectionTitle}>
                    <span>02</span>
                    <div><h2>填写充值信息</h2><p>请确认币种与网络匹配</p></div>
                  </div>

                  <div className={styles.twoColumns}>
                    <FieldShell label="币种">
                      <div className={styles.selectWrap}>
                        <select value={asset} onChange={(event) => setAsset(event.target.value as Asset)}>
                          {ASSETS.map((item) => <option key={item}>{item}</option>)}
                        </select>
                        <Icon name="chevron" size={15} />
                      </div>
                    </FieldShell>
                    <FieldShell label="充值金额" hint={`Available ${BALANCES[asset].amount}`}>
                      <div className={styles.amountInput}>
                        <input min="0.000001" name="amount" placeholder="0.00" required step="any" type="number" />
                        <span>{asset}</span>
                      </div>
                    </FieldShell>
                  </div>

                  {rail === "internal" ? (
                    <FieldShell label="付款方 UID" hint="4–20 位字符">
                      <div className={styles.textInput}>
                        <Icon name="id" size={18} />
                        <input defaultValue="UID-580219" maxLength={20} name="sourceUid" required />
                      </div>
                    </FieldShell>
                  ) : (
                    <>
                      <FieldShell label="网络">
                        <div className={styles.selectWrap}>
                          <select value={activeNetwork} onChange={(event) => setNetwork(event.target.value as Network)}>
                            {availableNetworks.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <Icon name="chevron" size={15} />
                        </div>
                      </FieldShell>
                      <div className={styles.addressPanel}>
                        <span className={styles.qrMock} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
                        <div>
                          <span>{asset} 充值地址</span>
                          <code>{depositAddress}</code>
                          <small>仅向此地址转入 {asset}，Demo 不会监测真实链上交易。</small>
                        </div>
                        <button onClick={copyDepositAddress} type="button">
                          {copied ? <Icon name="check" size={17} /> : <Icon name="copy" size={17} />}
                          {copied ? "已复制" : "复制"}
                        </button>
                      </div>
                    </>
                  )}

                  <button className={styles.submitButton} disabled={submitting} type="submit">
                    {submitting ? <span className={styles.spinner} /> : <Icon name={rail === "internal" ? "bolt" : "arrowDown"} />}
                    {submitting ? "提交中…" : rail === "internal" ? "确认站内充值" : "模拟链上充值"}
                  </button>
                </form>
              ) : (
                <form className={styles.form} onSubmit={handleWithdrawal}>
                  <div className={styles.formSectionTitle}>
                    <span>02</span>
                    <div><h2>填写提取信息</h2><p>提交后将进入安全审核</p></div>
                  </div>

                  <div className={styles.twoColumns}>
                    <FieldShell label="币种">
                      <div className={styles.selectWrap}>
                        <select value={asset} onChange={(event) => setAsset(event.target.value as Asset)}>
                          {ASSETS.map((item) => <option key={item}>{item}</option>)}
                        </select>
                        <Icon name="chevron" size={15} />
                      </div>
                    </FieldShell>
                    <FieldShell label="提取金额" hint={`Available ${BALANCES[asset].amount}`}>
                      <div className={styles.amountInput}>
                        <input min="0.000001" name="amount" placeholder="0.00" required step="any" type="number" />
                        <span>{asset}</span>
                      </div>
                    </FieldShell>
                  </div>

                  {rail === "internal" ? (
                    <FieldShell label="收款方 UID">
                      <div className={styles.textInput}>
                        <Icon name="id" size={18} />
                        <input defaultValue="UID-761204" maxLength={20} name="recipientUid" required />
                      </div>
                    </FieldShell>
                  ) : (
                    <>
                      <FieldShell label="网络">
                        <div className={styles.selectWrap}>
                          <select value={activeNetwork} onChange={(event) => setNetwork(event.target.value as Network)}>
                            {availableNetworks.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <Icon name="chevron" size={15} />
                        </div>
                      </FieldShell>
                      <FieldShell label="链上收款地址" hint="请仔细核对">
                        <div className={styles.textInput}>
                          <Icon name="globe" size={18} />
                          <input defaultValue="TVnD3moReceiver9Qx8K2pL5sW7yA4cB6" name="address" required />
                        </div>
                      </FieldShell>
                    </>
                  )}

                  <div className={styles.feeLine}>
                    <span>预计手续费 <Icon name="help" size={14} /></span>
                    <strong>{rail === "internal" ? `0 ${asset}` : asset === "USDT" ? "0.8 USDT" : `0.0004 ${asset}`}</strong>
                  </div>

                  <section className={styles.securityPanel}>
                    <header>
                      <span><Icon name="shield" size={20} /></span>
                      <div><h3>三重安全验证</h3><p>三项均为 Mock，但后端会完整校验</p></div>
                      <small><Icon name="spark" size={13} /> Demo</small>
                    </header>
                    <VerificationField icon="phone" label="手机验证" maskedTarget="+86 138 **** 7821" codeKey="phoneCode" value={codes.phoneCode} onChange={(value) => updateCode("phoneCode", value)} onFill={fillMockCode} />
                    <VerificationField icon="mail" label="邮箱验证" maskedTarget="th***@example.com" codeKey="emailCode" value={codes.emailCode} onChange={(value) => updateCode("emailCode", value)} onFill={fillMockCode} />
                    <VerificationField icon="shield" label="Google 验证器" maskedTarget="Authenticator app" codeKey="authenticatorCode" value={codes.authenticatorCode} onChange={(value) => updateCode("authenticatorCode", value)} onFill={fillMockCode} />
                  </section>

                  <button className={`${styles.submitButton} ${styles.withdrawButton}`} disabled={submitting} type="submit">
                    {submitting ? <span className={styles.spinner} /> : <Icon name="shield" />}
                    {submitting ? "安全校验中…" : rail === "internal" ? "验证并提交站内提取" : "验证并提交链上提取"}
                  </button>
                </form>
              )}

              {notice ? (
                <div className={`${styles.notice} ${styles[notice.kind]}`} role="status">
                  <Icon name={notice.kind === "error" ? "help" : notice.kind === "success" ? "check" : "spark"} size={17} />
                  {notice.message}
                </div>
              ) : null}
            </div>
          </section>

          <aside className={styles.activityCard} id="activity">
            <header className={styles.activityHeader}>
              <div>
                <span className={styles.liveIcon}><Icon name="bolt" size={17} /></span>
                <div><h2>实时资金动态</h2><p>Server-Sent Events</p></div>
              </div>
              <span className={`${styles.streamBadge} ${styles[streamState]}`}>
                <i />{streamState === "live" ? "LIVE" : streamState === "connecting" ? "CONNECTING" : "RECONNECTING"}
              </span>
            </header>

            <div className={styles.streamInfo}>
              <Icon name="spark" size={16} />
              <span>SSE 通道已启用，交易状态无需刷新即时推送。</span>
            </div>

            <div className={styles.activityList} aria-live="polite">
              {transactions.length === 0 ? (
                <div className={styles.activityEmpty}>
                  <span className={styles.spinner} />
                  <p>正在同步资金动态…</p>
                </div>
              ) : (
                transactions.slice(0, 7).map((transaction) => {
                  const status = STATUS_META[transaction.status];
                  return (
                    <article className={styles.activityItem} key={transaction.id}>
                      <span className={`${styles.activityDirection} ${transaction.kind === "deposit" ? styles.inbound : styles.outbound}`}>
                        <Icon name={transaction.kind === "deposit" ? "arrowDown" : "arrowUp"} size={18} />
                      </span>
                      <div className={styles.activityMain}>
                        <div>
                          <strong>{transaction.rail === "internal" ? "站内" : "链上"}{transaction.kind === "deposit" ? "充值" : "提取"}</strong>
                          <time>{formatTime(transaction.updatedAt)}</time>
                        </div>
                        <span>{shortText(transaction.counterparty)}</span>
                        <small>{transaction.statusDetail}</small>
                        {transaction.confirmations ? (
                          <span className={styles.confirmationTrack}>
                            <i style={{ width: `${(transaction.confirmations.current / transaction.confirmations.required) * 100}%` }} />
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.activityAmount}>
                        <strong className={transaction.kind === "deposit" ? styles.positive : ""}>
                          {transaction.kind === "deposit" ? "+" : "−"}{formatAmount(transaction)}
                        </strong>
                        <span>{transaction.asset}</span>
                        <small className={styles[status.tone]}>{status.label}</small>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <footer className={styles.activityFooter}>
              <span><i /> GET /api/events</span>
              <span>{transactions.length} records</span>
            </footer>
          </aside>
        </div>

        <footer className={styles.disclaimer}>
          <Icon name="shield" size={16} />
          此项目仅为功能演示，使用内存数据与 Mock 验证码，不处理任何真实资产。
        </footer>
      </main>
    </div>
  );
}
