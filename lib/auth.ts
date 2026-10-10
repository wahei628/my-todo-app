import { createClient } from "@/lib/supabase/server";

// Route Handler 用：ログイン中ユーザーの ID を返す。未ログインなら null。
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return null;
  }
  return data.claims.sub;
}
