export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">ダッシュボード</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        ログインに成功しました。今後ここに今月の収支サマリ・予算消化率・最近の取引が表示されます。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <PlaceholderCard title="今月の収入" value="¥ ——" />
        <PlaceholderCard title="今月の支出" value="¥ ——" />
        <PlaceholderCard title="今月の収支差" value="¥ ——" />
      </div>

      <p className="mt-8 text-xs text-zinc-500">
        ※ 取引入力 (F2)・カテゴリ集計 (F4)・予算 (F5) は今後の実装で繋がります。
      </p>
    </div>
  );
}

function PlaceholderCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
