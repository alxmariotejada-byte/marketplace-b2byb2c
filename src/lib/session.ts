import "server-only";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Channel } from "./shared";

export async function getMode(): Promise<Channel> {
  const c = await cookies();
  return c.get("modo")?.value === "B2B" ? "B2B" : "B2C";
}

function adminToken(): string | null {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return null;
  return createHash("sha256").update("logimkt-admin:" + pwd).digest("hex");
}

export function checkPassword(pwd: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(createHash("sha256").update(pwd).digest("hex"));
  const b = Buffer.from(createHash("sha256").update(real).digest("hex"));
  return timingSafeEqual(a, b);
}

export function sessionValue(): string {
  return adminToken() ?? "";
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  if (!token) return false;
  const c = await cookies();
  return c.get("admin")?.value === token;
}
