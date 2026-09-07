import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_DESTINATION = "https://webris.levan.jp";

// Click-tracking redirect used in outbound email links:
// https://hub.levan.jp/api/track/click/{messageId}?to=https%3A%2F%2Fwebris.levan.jp
export async function GET(req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const url = new URL(req.url);
  const destination = url.searchParams.get("to") || DEFAULT_DESTINATION;

  await prisma.outreachMessage
    .updateMany({ where: { id: messageId, clickedAt: null }, data: { clickedAt: new Date() } })
    .catch(() => null);

  return NextResponse.redirect(destination);
}
