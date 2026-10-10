"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

// Supabase Auth のエラーコードを日本語のメッセージにする
function signupErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "email_address_invalid":
      return "このメールアドレスには確認メールを送信できません。別のメールアドレスをお試しください。";
    case "over_email_send_rate_limit":
      return "メールの送信回数が上限に達しました。しばらく時間をおいてからお試しください。";
    case "user_already_exists":
    case "email_exists":
      return "このメールアドレスはすでに登録されています。";
    case "weak_password":
      return "パスワードが弱すぎます。より長く複雑なパスワードにしてください。";
    default:
      return fallback;
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(signupErrorMessage(error.code, error.message));
      setLoading(false);
      return;
    }

    // メール確認が無効な設定なら、その場でログイン済みになる
    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }

    setMessage(
      "確認メールを送信しました。メール内のリンクを開いて登録を完了してください。",
    );
    setLoading(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-semibold">新規登録</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            メールアドレス
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            パスワード（6文字以上）
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-400">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "登録中..." : "登録する"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-indigo-400 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
