"use client";

import { cancelSubscriptionAction } from "../actions";

export default function CancelSubscriptionForm({ orgId }: { orgId: string }) {
  return (
    <form
      action={cancelSubscriptionAction}
      onSubmit={(e) => {
        if (!confirm("本当にこの契約を今すぐ解約しますか？この操作は元に戻せません。")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orgId" value={orgId} />
      <button
        type="submit"
        className="text-sm bg-[var(--danger)] hover:opacity-90 text-white rounded-xl px-4 py-2 font-medium shadow-sm"
      >
        今すぐ解約する
      </button>
    </form>
  );
}
