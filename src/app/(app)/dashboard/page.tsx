"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeCategories } from "@/lib/categories";
import { subscribeTransactionsByMonth } from "@/lib/transactions";
import {
  breakdownByCategory,
  summarize,
  type CategoryBreakdownItem,
} from "@/lib/aggregations";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

const today = new Date();

export default function DashboardPage() {
  const { user, configured } = useAuth();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !configured) return;
    const unsub = subscribeCategories(user.uid, setCategories);
    return unsub;
  }, [user, configured]);

  useEffect(() => {
    if (!user || !configured) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTransactionsByMonth(user.uid, year, month, (list) => {
      setTransactions(list);
      setLoading(false);
    });
    return unsub;
  }, [user, configured, year, month]);

  const summary = useMemo(() => summarize(transactions), [transactions]);
  const expenseByCategory = useMemo(
    () => breakdownByCategory(transactions, categories, "expense"),
    [transactions, categories],
  );
  const incomeByCategory = useMemo(
    () => breakdownByCategory(transactions, categories, "income"),
    [transactions, categories],
  );

  if (!configured) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        Firebase が未設定です。`.env.local` に Firebase の設定値を入力してから再読み込みしてください。
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <p className="text-sm text-zinc-500">
          {year}年 {String(month).padStart(2, "0")}月
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="今月の収入" amount={summary.income} tone="income" />
        <SummaryCard label="今月の支出" amount={summary.expense} tone="expense" />
        <SummaryCard
          label="今月の差額"
          amount={summary.balance}
          tone={summary.balance >= 0 ? "income" : "expense"}
        />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">読み込み中…</p>
      ) : transactions.length === 0 ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          まだ今月の取引がありません。
          <Link href="/transactions" className="ml-1 underline">
            取引を追加
          </Link>
          すると、ここにカテゴリ別グラフが表示されます。
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ChartCard title="カテゴリ別 支出">
            {expenseByCategory.length === 0 ? (
              <EmptyChart message="支出データはありません。" />
            ) : (
              <CategoryPie items={expenseByCategory} />
            )}
          </ChartCard>
          <ChartCard title="カテゴリ別 ランキング (支出)">
            {expenseByCategory.length === 0 ? (
              <EmptyChart message="支出データはありません。" />
            ) : (
              <CategoryBar items={expenseByCategory.slice(0, 8)} />
            )}
          </ChartCard>
          {incomeByCategory.length > 0 && (
            <ChartCard title="カテゴリ別 収入">
              <CategoryBar items={incomeByCategory.slice(0, 8)} />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "income" | "expense";
}) {
  const colorClass =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${colorClass}`}>
        ¥ {amount.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-500">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function CategoryPie({ items }: { items: CategoryBreakdownItem[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            dataKey="total"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {items.map((item) => (
              <Cell key={item.categoryId} fill={item.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatYen(Number(value))}
            wrapperStyle={{ outline: "none" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryBar({ items }: { items: CategoryBreakdownItem[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ left: 12, right: 12 }}>
          <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={10} />
          <YAxis dataKey="name" type="category" width={70} fontSize={11} />
          <Tooltip
            formatter={(value) => formatYen(Number(value))}
            wrapperStyle={{ outline: "none" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(228, 228, 231, 0.4)" }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {items.map((item) => (
              <Cell key={item.categoryId} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
