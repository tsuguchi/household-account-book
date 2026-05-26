"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeAccounts } from "@/lib/accounts";
import { subscribeCategories } from "@/lib/categories";
import { downloadCsv } from "@/lib/csv";
import {
  exportTransactionsCsv,
  importTransactionsCsv,
  type ImportResult,
} from "@/lib/dataIo";
import type { Account } from "@/types/account";
import type { Category } from "@/types/category";

export default function DataPage() {
  const { user, configured } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeAccounts(user.uid, setAccounts);
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) return;
    return subscribeCategories(user.uid, setCategories);
  }, [user, configured]);

  if (!configured) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </div>
    );
  }

  async function handleExport() {
    if (!user) return;
    setExporting(true);
    setExportError(null);
    try {
      const csv = await exportTransactionsCsv(user.uid, accounts, categories);
      const fileName = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(fileName, csv);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "エクスポートに失敗しました。");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = await importTransactionsCsv(user.uid, text, accounts, categories);
      setImportResult(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "インポートに失敗しました。");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">データ</h1>
      <p className="mt-2 text-sm text-zinc-500">
        取引データを CSV でエクスポート・インポートできます。バックアップや他アプリからの移行に利用してください。
      </p>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">エクスポート</h2>
        <p className="mt-1 text-sm text-zinc-500">
          全期間の取引を CSV ファイルとしてダウンロードします。列順: date, kind, amount, category, account, memo
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 min-h-11 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {exporting ? "出力中…" : "CSV をダウンロード"}
        </button>
        {exportError && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {exportError}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">インポート</h2>
        <div className="mt-1 space-y-1 text-sm text-zinc-500">
          <p>同じフォーマット (date, kind, amount, category, account, memo) の CSV を取り込みます。</p>
          <ul className="ml-5 list-disc">
            <li>kind は <code>expense</code> または <code>income</code></li>
            <li>category / account は <strong>既存の名前と完全一致</strong>している必要があります</li>
            <li>1 行目はヘッダー行 (省略不可)</li>
          </ul>
        </div>
        <label className="mt-3 inline-flex items-center gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            disabled={importing}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-100 disabled:opacity-50 dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:hover:file:bg-zinc-800"
          />
        </label>
        {importing && <p className="mt-3 text-sm text-zinc-500">読み込み中…</p>}
        {importError && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {importError}
          </p>
        )}
        {importResult && <ImportSummary result={importResult} />}
      </section>
    </div>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p>
        <span className="font-medium">追加: {result.inserted} 件</span>
        {result.errors.length > 0 && (
          <span className="ml-2 text-rose-600 dark:text-rose-400">
            / スキップ: {result.errors.length} 件
          </span>
        )}
      </p>
      {result.errors.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-zinc-500">エラー詳細を表示</summary>
          <ul className="mt-2 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {result.errors.map((e) => (
              <li key={`${e.rowNumber}-${e.reason}`}>
                行 {e.rowNumber}: {e.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
