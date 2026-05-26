export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          家計簿アプリ
        </h1>
        <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
          収入・支出を記録し、予算と口座を一元管理する個人向け家計簿。
        </p>
        <p className="mt-8 text-sm text-zinc-500">
          現在セットアップ中です。認証機能を実装するとここからログイン画面へ遷移します。
        </p>
      </div>
    </main>
  );
}
