import { createBrowserClient } from "@supabase/ssr";

// ブラウザ用の Supabase クライアント。
// セッションは Cookie に保存されるので、proxy.ts からもログイン状態を確認できる。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
