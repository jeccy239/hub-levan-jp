"use client";

import { changePlanAction } from "../actions";

// テスト用の「シークレットプラン」。顧客側の画面からは選べず、LEVAN HUBの
// この画面からのみ切り替えられる。planCode は WEBRIS 側で用意した固定コード。
const SECRET_PLAN_CODE = "secret";

export default function SecretPlanForm({
  orgId,
  isSecret,
}: {
  orgId: string;
  isSecret: boolean;
}) {
  return (
    <form
      action={changePlanAction}
      onSubmit={(e) => {
        const msg = isSecret
          ? "このアカウントを Free プランに戻します。よろしいですか？"
          : "このアカウントをテスト用のシークレットプランに変更します。よろしいですか？";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="planCode" value={isSecret ? "free" : SECRET_PLAN_CODE} />
      <button
        type="submit"
        className={
          isSecret
            ? "text-sm border border-[var(--line)] hover:bg-[var(--surface-2)] text-[var(--text)] rounded-xl px-4 py-2 font-medium"
            : "text-sm bg-[var(--gold)] hover:opacity-90 text-white rounded-xl px-4 py-2 font-medium shadow-sm"
        }
      >
        {isSecret ? "通常プラン（Free）に戻す" : "シークレットプランに変更"}
      </button>
    </form>
  );
}
