import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { FormEvent, ReactElement, useState } from "react";

import { Seo } from "@/components/Seo";
import { isAuthenticated } from "@/lib/auth";

export default function AdminLogin() {
  const router = useRouter();
  const from = typeof router.query.from === "string" ? router.query.from : "/admin/resources";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      router.replace(from);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Seo title="后台登录" description="" path="/admin/login" noindex />
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-logo">
            <span className="admin-login-icon">☁</span>
          </div>
          <h1 className="admin-login-title">后台登录</h1>
          <p className="admin-login-sub">云盘资源社 · 运营管理系统</p>

          <form className="admin-login-form" onSubmit={handleSubmit}>
            <div className="admin-login-field">
              <label htmlFor="password">管理员密码</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="admin-login-error">{error}</p>}

            <button
              type="submit"
              className="admin-login-btn"
              disabled={loading || !password}
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

// If already logged in, redirect straight to admin
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (isAuthenticated(ctx.req)) {
    const from =
      typeof ctx.query.from === "string" ? ctx.query.from : "/admin/resources";
    return { redirect: { destination: from, permanent: false } };
  }
  return { props: {} };
};

AdminLogin.getLayout = (page: ReactElement) => page;
