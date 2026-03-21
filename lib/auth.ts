import crypto from "node:crypto";
import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE_NAME = "admin_token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  return process.env.ADMIN_SECRET || "wangpan_dev_secret_change_in_prod";
}

function getPassword() {
  return process.env.ADMIN_PASSWORD || "admin888";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function makeToken(): string {
  const ts = Date.now().toString(36);
  const sig = sign(ts);
  return `${ts}.${sig}`;
}

function verifyToken(token: string): boolean {
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = sign(ts);
  // constant-time compare
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  const expected = getPassword();
  try {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function setAuthCookie(res: ServerResponse): void {
  const token = makeToken();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Strict`
  );
}

export function clearAuthCookie(res: ServerResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`
  );
}

export function isAuthenticated(req: IncomingMessage): boolean {
  const raw = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    raw.split(";").map((c) => {
      const idx = c.indexOf("=");
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  return verifyToken(token);
}

/** Use in getServerSideProps to guard admin pages */
export function requireAdminAuth<T extends Record<string, unknown>>(
  ctx: GetServerSidePropsContext,
  next: () => Promise<GetServerSidePropsResult<T>>
): Promise<GetServerSidePropsResult<T>> {
  if (!isAuthenticated(ctx.req)) {
    return Promise.resolve({
      redirect: {
        destination: `/admin/login?from=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    });
  }
  return next();
}
