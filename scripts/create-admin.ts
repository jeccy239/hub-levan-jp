// Usage: npx tsx scripts/create-admin.ts <email> <name>
// Creates (or resets the password of) an ADMIN user and prints a generated
// password once. Requires DATABASE_URL in env, same as any prisma command.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const [email, name] = process.argv.slice(2);
if (!email || !name) {
  console.error("Usage: npx tsx scripts/create-admin.ts <email> <name>");
  process.exit(1);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const password = randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", name },
    create: { email, name, role: "ADMIN", passwordHash },
  });

  console.log(`ユーザー作成/更新: ${user.email} (role: ${user.role})`);
  console.log(`初回パスワード: ${password}`);
  console.log("このパスワードは今しか表示されません。安全な場所に控えてください。");

  await prisma.$disconnect();
}

main();
