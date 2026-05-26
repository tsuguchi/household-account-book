"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createAccount,
  deleteAccount,
  subscribeAccounts,
  updateAccount,
} from "@/lib/accounts";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountInput,
  type AccountType,
} from "@/types/account";

type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; account: Account };

export default function AccountsPage() {
  const { user, configured } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: "closed" });

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeAccounts(
      user.uid,
      (list) => {
        setAccounts(list);
        setLoading(false);
        setLoadError(null);
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, configured]);

  if (!configured) {
    return (
      <NoticeBox>
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </NoticeBox>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">口座</h1>
        {form.mode === "closed" && (
          <button
            type="button"
            onClick={() => setForm({ mode: "create" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + 口座を追加
          </button>
        )}
      </div>

      {form.mode !== "closed" && user && (
        <AccountForm
          key={form.mode === "edit" ? form.account.id : "new"}
          initial={form.mode === "edit" ? form.account : undefined}
          onCancel={() => setForm({ mode: "closed" })}
          onSubmit={async (input) => {
            if (form.mode === "edit") {
              await updateAccount(user.uid, form.account.id, input);
            } else {
              await createAccount(user.uid, input);
            }
            setForm({ mode: "closed" });
          }}
        />
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-zinc-500">読み込み中…</p>
        ) : loadError ? (
          <NoticeBox tone="error">読み込みに失敗しました: {loadError}</NoticeBox>
        ) : accounts.length === 0 ? (
          <NoticeBox>
            まだ口座が登録されていません。「口座を追加」ボタンから現金・銀行口座・カード等を登録してください。
          </NoticeBox>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onEdit={() => setForm({ mode: "edit", account })}
                onDelete={async () => {
                  if (!user) return;
                  const ok = window.confirm(
                    `「${account.name}」を削除します。よろしいですか？`,
                  );
                  if (!ok) return;
                  await deleteAccount(user.uid, account.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AccountRow({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{account.name}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {ACCOUNT_TYPE_LABELS[account.type]}・初期残高 ¥{account.initialBalance.toLocaleString("ja-JP")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          削除
        </button>
      </div>
    </li>
  );
}

function AccountForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Account;
  onSubmit: (input: AccountInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AccountType>(initial?.type ?? "cash");
  const [initialBalance, setInitialBalance] = useState(
    String(initial?.initialBalance ?? 0),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const parsed = Number(initialBalance);
    if (Number.isNaN(parsed)) {
      setError("初期残高は数値で入力してください。");
      setSubmitting(false);
      return;
    }
    try {
      await onSubmit({ name: name.trim(), type, initialBalance: Math.round(parsed) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold">
        {initial ? "口座を編集" : "口座を追加"}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="account-name" className="block text-sm font-medium">
            口座名
          </label>
          <input
            id="account-name"
            type="text"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 三井住友銀行"
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label htmlFor="account-type" className="block text-sm font-medium">
            種別
          </label>
          <select
            id="account-type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="account-initial" className="block text-sm font-medium">
            初期残高 (円)
          </label>
          <input
            id="account-initial"
            type="number"
            inputMode="numeric"
            step={1}
            required
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {submitting ? "保存中…" : initial ? "更新" : "追加"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

function NoticeBox({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error";
}) {
  const toneClass =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  return (
    <div className={`rounded-lg border p-4 text-sm ${toneClass}`}>{children}</div>
  );
}
