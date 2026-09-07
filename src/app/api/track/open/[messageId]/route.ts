import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF, embedded in outbound email bodies as an open-tracking
// pixel: <img src="https://hub.levan.jp/api/track/open/{messageId}">
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);

export async function GET(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  await prisma.outreachMessage
    .updateMany({ where: { id: messageId, openedAt: null }, data: { openedAt: new Date() } })
    .catch(() => null); // unknown id — never fail the pixel response

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}
