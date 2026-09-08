// 手入力欄のパース。サーバ（送信前検証）とクライアント（入力中の表示）の
// 両方から使うので、DBやNode専用APIに依存させないこと。

const BARE_EMAIL = /[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+/g;
// 「名前 <foo@example.com>」— 名前ごと1つの塊として食べる。こうしないと
// 名前部分が単独トークンとして残り、不正入力として誤検出される。
const NAMED_EMAIL = /[^<>\n,;]*<\s*([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)\s*>/g;

export function isValidEmail(email: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.trim());
}

/**
 * 自由入力からアドレスを抜き出す。改行・カンマ・読点・空白区切り、
 * 「名前 <foo@example.com>」形式のいずれも受ける。
 *
 * invalid に入れるのは「アドレスのつもりで書かれたのに壊れているもの」だけ。
 * 名前だけの単語を弾くと、上記の名前付き形式が常にエラーになってしまう。
 */
export function parseManualEmails(raw: string): { valid: string[]; invalid: string[] } {
  let rest = raw;
  const found: string[] = [];

  rest = rest.replace(NAMED_EMAIL, (_m, email: string) => {
    found.push(email);
    return " ";
  });
  rest = rest.replace(BARE_EMAIL, (m) => {
    found.push(m);
    return " ";
  });

  // 残りに @ や < > が混じっていれば、アドレスの書き損じとみなす
  const invalid = rest
    .split(/[\s,;、\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && /[@<>]/.test(t));

  const valid: string[] = [];
  const seen = new Set<string>();
  for (const e of found) {
    const email = e.trim().toLowerCase();
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }

  return { valid, invalid: [...new Set(invalid)] };
}
