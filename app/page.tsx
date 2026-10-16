"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CreateTodoRequest,
  CreateTodoResponse,
  ErrorResponse,
  GetTodosResponse,
  Todo,
} from "@/app/api/todos/route";
import type {
  DeleteTodoResponse,
  UpdateTodoRequest,
  UpdateTodoResponse,
} from "@/app/api/todos/[id]/route";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// API を呼び出し、失敗したら ErrorResponse のメッセージで例外を投げる
async function requestJson<T>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ErrorResponse | null;
    throw new ApiError(res.status, data?.error ?? "通信に失敗しました");
  }
  return (await res.json()) as T;
}

// ローカル時刻での今日（YYYY-MM-DD）
function todayString() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

// サーバーと同じ並び順：期限の近い順、期限なしは最後、同じ期限なら新しい順
function sortTodos(todos: Todo[]) {
  return [...todos].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// "2026-10-20" → "10/20"（今年以外は年も付ける）
function formatDueDate(dueDate: string, today: string) {
  const [y, m, d] = dueDate.split("-");
  const md = `${Number(m)}/${Number(d)}`;
  return y === today.slice(0, 4) ? md : `${y}/${md}`;
}

function dueBadge(todo: Todo, today: string) {
  if (!todo.dueDate) {
    return { label: "期限なし", className: "text-zinc-600" };
  }
  const date = formatDueDate(todo.dueDate, today);
  if (todo.isCompleted) {
    return { label: date, className: "text-zinc-500" };
  }
  if (todo.dueDate < today) {
    return {
      label: `期限切れ ${date}`,
      className: "bg-red-950/60 text-red-400",
    };
  }
  if (todo.dueDate === today) {
    return { label: "今日", className: "bg-amber-950/60 text-amber-400" };
  }
  return { label: date, className: "bg-zinc-800 text-zinc-300" };
}

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 期限切れ判定に使う今日の日付。cacheComponents では描画中に new Date() を
  // 呼べない（事前レンダリングでビルドエラーになる）ので、取得完了時に決める
  const [today, setToday] = useState("");

  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      router.replace("/login");
      return;
    }
    setError(e instanceof Error ? e.message : "エラーが発生しました");
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });

    requestJson<GetTodosResponse>("/api/todos")
      .then((data) => setTodos(data.todos))
      .catch(handleError)
      .finally(() => {
        setToday(todayString());
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setError(null);
    setAdding(true);
    try {
      const data = await requestJson<CreateTodoResponse>("/api/todos", {
        method: "POST",
        body: {
          title: trimmed,
          dueDate: dueDate || null,
        } satisfies CreateTodoRequest,
      });
      setTodos((prev) => [data.todo, ...prev]);
      setTitle("");
      setDueDate("");
    } catch (e) {
      handleError(e);
    } finally {
      setAdding(false);
    }
  }

  // 完了状態・期限日の変更。先に画面を更新し、失敗したら元に戻す
  async function handleUpdate(todo: Todo, changes: UpdateTodoRequest) {
    setError(null);
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, ...changes } : t)),
    );
    try {
      const data = await requestJson<UpdateTodoResponse>(
        `/api/todos/${todo.id}`,
        { method: "PATCH", body: changes },
      );
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? data.todo : t)));
    } catch (e) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
      handleError(e);
    }
  }

  async function handleDelete(todo: Todo) {
    setError(null);
    const snapshot = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    try {
      await requestJson<DeleteTodoResponse>(`/api/todos/${todo.id}`, {
        method: "DELETE",
      });
    } catch (e) {
      setTodos(snapshot);
      handleError(e);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const remaining = todos.filter((t) => !t.isCompleted).length;
  const sortedTodos = sortTodos(todos);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="shrink-0 text-lg font-semibold">My TODO App</h1>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="hidden truncate text-zinc-400 sm:inline">
              {email}
            </span>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 transition-colors hover:bg-zinc-800"
            >
              ログアウト
            </button>
          </div>
        </div>
        {/* スマホではメールアドレスを 2 行目に表示 */}
        {email && (
          <p className="truncate px-4 pb-2 text-xs text-zinc-400 sm:hidden">
            {email}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl sm:p-6">
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="新しい TODO を入力"
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="期限日（任意）"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:w-40"
            />
            <button
              type="submit"
              disabled={adding || !title.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? "追加中..." : "追加"}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="mt-6">
            {loading ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                読み込み中...
              </p>
            ) : todos.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                TODO はまだありません
              </p>
            ) : (
              <>
                <ul className="divide-y divide-zinc-800">
                  {sortedTodos.map((todo) => {
                    const badge = dueBadge(todo, today);
                    return (
                      <li
                        key={todo.id}
                        className="flex items-center gap-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={todo.isCompleted}
                          onChange={() =>
                            handleUpdate(todo, {
                              isCompleted: !todo.isCompleted,
                            })
                          }
                          aria-label={`「${todo.title}」を完了にする`}
                          className="size-5 shrink-0 cursor-pointer accent-indigo-500"
                        />
                        <span
                          className={`min-w-0 flex-1 break-words ${
                            todo.isCompleted
                              ? "text-zinc-500 line-through"
                              : "text-zinc-100"
                          }`}
                        >
                          {todo.title}
                        </span>
                        {/* バッジに透明な日付入力を重ね、タップで日付ピッカーを開く */}
                        <label
                          className={`relative shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs whitespace-nowrap ${badge.className}`}
                        >
                          {badge.label}
                          <input
                            type="date"
                            value={todo.dueDate ?? ""}
                            onChange={(e) =>
                              handleUpdate(todo, {
                                dueDate: e.target.value || null,
                              })
                            }
                            onClick={(e) => {
                              try {
                                e.currentTarget.showPicker();
                              } catch {
                                // showPicker 非対応のブラウザでは通常の入力になる
                              }
                            }}
                            aria-label={`「${todo.title}」の期限日を変更`}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                        </label>
                        <button
                          onClick={() => handleDelete(todo)}
                          className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-red-950/50 hover:text-red-400"
                        >
                          削除
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-right text-xs text-zinc-500">
                  残り {remaining} 件 / 全 {todos.length} 件
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
