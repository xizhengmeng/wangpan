"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from "react";

import { Feedback, Resource } from "@/lib/types";

type Tab = "dashboard" | "resources" | "form" | "import" | "feedback";

interface TopResource { resourceId: string; title: string; slug: string; count: number }
interface LowConversionResource { resourceId: string; title: string; slug: string; detailViews: number; downloads: number }

interface AdminResourcesClientProps {
  initialResources: Resource[];
  metrics: Array<{ label: string; value: string }>;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
  topResources: TopResource[];
  lowConversionResources: LowConversionResource[];
  initialFeedback: Feedback[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  offline: "已下线",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "#faad14",
  published: "#52c41a",
  offline: "#8c8c8c",
};
const FEEDBACK_REASON_LABELS: Record<string, string> = {
  expired: "链接失效",
  wrong_file: "文件错误",
  extract_error: "提取码错误",
  other: "其他",
};

const emptyForm = {
  id: "",
  title: "",
  slug: "",
  summary: "",
  category: "",
  tags: "",
  cover: "",
  quark_url: "",
  extract_code: "",
  publish_status: "draft",
  published_at: new Date().toISOString().slice(0, 16),
};

export function AdminResourcesClient({
  initialResources,
  metrics,
  topQueries,
  noResultQueries,
  topResources,
  lowConversionResources,
  initialFeedback,
}: AdminResourcesClientProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [resources, setResources] = useState(initialResources);
  const [form, setForm] = useState(emptyForm);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleSearch, setTitleSearch] = useState("");
  const [feedback, setFeedback] = useState(initialFeedback);

  const sortedResources = useMemo(
    () =>
      [...resources].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [resources]
  );

  const filteredResources = useMemo(() => {
    return sortedResources.filter((r) => {
      if (statusFilter !== "all" && r.publish_status !== statusFilter) return false;
      if (titleSearch && !r.title.toLowerCase().includes(titleSearch.toLowerCase())) return false;
      return true;
    });
  }, [sortedResources, statusFilter, titleSearch]);

  function notify(type: "ok" | "err", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function refreshResources() {
    const res = await fetch("/api/admin/resources");
    const data = (await res.json()) as { items: Resource[] };
    setResources(data.items);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((c) => ({ ...c, [name]: value }));
  }

  function handleEdit(resource: Resource) {
    setForm({
      id: resource.id,
      title: resource.title,
      slug: resource.slug,
      summary: resource.summary,
      category: resource.category,
      tags: resource.tags.join(", "),
      cover: resource.cover,
      quark_url: resource.quark_url,
      extract_code: resource.extract_code || "",
      publish_status: resource.publish_status,
      published_at: resource.published_at.slice(0, 16),
    });
    setTab("form");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const payload = {
        ...form,
        tags: form.tags.split(/[|,，]/).map((t) => t.trim()).filter(Boolean),
        published_at: new Date(form.published_at).toISOString(),
      };
      const method = form.id ? "PUT" : "POST";
      const url = form.id ? `/api/admin/resources/${form.id}` : "/api/admin/resources";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { notify("err", data.error || "保存失败"); return; }
      await refreshResources();
      setForm(emptyForm);
      notify("ok", form.id ? "资源已更新" : "资源已新增");
      setTab("resources");
    });
  }

  function handleQuickStatus(id: string, status: "published" | "offline") {
    startTransition(async () => {
      const resource = resources.find((r) => r.id === id);
      if (!resource) return;
      const res = await fetch(`/api/admin/resources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...resource, publish_status: status }),
      });
      if (!res.ok) { notify("err", "状态更新失败"); return; }
      await refreshResources();
      notify("ok", status === "offline" ? "已下线" : "已发布");
    });
  }

  function handleDelete(id: string) {
    if (!confirm("确认删除？此操作不可撤销。")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" });
      if (!res.ok) { notify("err", "删除失败"); return; }
      await refreshResources();
      notify("ok", "资源已删除");
    });
  }

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(file);
  }

  function handleImport() {
    startTransition(async () => {
      const res = await fetch("/api/admin/resources/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, mode: "upsert" }),
      });
      const data = await res.json();
      if (!res.ok) { notify("err", data.error || "导入失败"); return; }
      await refreshResources();
      const msg = `导入完成：成功 ${data.successCount} 条，失败 ${data.failureCount} 条`;
      notify(data.failureCount > 0 ? "err" : "ok", msg);
    });
  }

  async function handleResolveFeedback(id: string) {
    const res = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { notify("err", "操作失败"); return; }
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, resolved: true } : f));
  }

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "dashboard", label: "📊 统计看板" },
    { key: "resources", label: "📦 资源管理", badge: resources.length },
    { key: "form", label: form.id ? "✏️ 编辑资源" : "➕ 新增资源" },
    { key: "import", label: "📤 批量导入" },
    { key: "feedback", label: "🚨 失效反馈", badge: feedback.filter((f) => !f.resolved).length },
  ];

  return (
    <div className="admin-shell">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__inner">
          <div>
            <h1 className="admin-header__title">运营后台</h1>
            <p className="admin-header__sub">资源管理 · 统计看板 · 失效反馈</p>
          </div>
          <Link href="/" className="admin-header__back">← 回到前台</Link>
        </div>

        {/* Tab nav */}
        <div className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-tab${tab === t.key ? " admin-tab--active" : ""}`}
              onClick={() => setTab(t.key)}
              type="button"
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="admin-tab__badge">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div className={`admin-toast admin-toast--${message.type}`}>{message.text}</div>
      )}

      <div className="admin-body">
        {/* ─── 统计看板 ─────────────────────────────── */}
        {tab === "dashboard" && (
          <div className="admin-dashboard">
            <div className="admin-metrics">
              {metrics.map((m) => (
                <div className="admin-metric-card" key={m.label}>
                  <strong>{m.value}</strong>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>

            <div className="admin-dashboard__grid">
              <div className="admin-panel">
                <div className="admin-panel__title">高频搜索词</div>
                {topQueries.length > 0 ? topQueries.map((item) => (
                  <div className="admin-rank-row" key={item.query}>
                    <span className="admin-rank-row__label">{item.query}</span>
                    <span className="admin-rank-row__count">{item.count}</span>
                  </div>
                )) : <p className="admin-empty">暂无数据</p>}
              </div>

              <div className="admin-panel">
                <div className="admin-panel__title">无结果搜索词 <small>→ 需要补库</small></div>
                {noResultQueries.length > 0 ? noResultQueries.map((item) => (
                  <div className="admin-rank-row admin-rank-row--warn" key={item.query}>
                    <span className="admin-rank-row__label">{item.query}</span>
                    <span className="admin-rank-row__count">{item.count}</span>
                  </div>
                )) : <p className="admin-empty">暂无数据</p>}
              </div>

              <div className="admin-panel">
                <div className="admin-panel__title">高点击资源排行</div>
                {topResources.length > 0 ? topResources.map((item) => (
                  <div className="admin-rank-row" key={item.resourceId}>
                    <Link href={`/resource/${item.slug}`} className="admin-rank-row__label admin-rank-row__link">{item.title}</Link>
                    <span className="admin-rank-row__count">{item.count} 次</span>
                  </div>
                )) : <p className="admin-empty">暂无点击数据</p>}
              </div>

              <div className="admin-panel">
                <div className="admin-panel__title">高点击低转化 <small>→ 需优化下载入口</small></div>
                {lowConversionResources.length > 0 ? lowConversionResources.map((item) => (
                  <div className="admin-rank-row" key={item.resourceId}>
                    <Link href={`/resource/${item.slug}`} className="admin-rank-row__label admin-rank-row__link">{item.title}</Link>
                    <span className="admin-rank-row__count">{item.detailViews}浏 / {item.downloads}下</span>
                  </div>
                )) : <p className="admin-empty">暂无数据</p>}
              </div>
            </div>
          </div>
        )}

        {/* ─── 资源管理 ─────────────────────────────── */}
        {tab === "resources" && (
          <div className="admin-resources">
            <div className="admin-filter-bar">
              <input
                className="admin-filter-input"
                placeholder="搜索标题..."
                value={titleSearch}
                onChange={(e) => setTitleSearch(e.target.value)}
              />
              <div className="admin-filter-tabs">
                {["all", "published", "draft", "offline"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`admin-filter-tab${statusFilter === s ? " admin-filter-tab--active" : ""}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "全部" : STATUS_LABELS[s]}
                    {" "}
                    <span className="admin-filter-tab__count">
                      {s === "all" ? resources.length : resources.filter((r) => r.publish_status === s).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-res-list">
              {filteredResources.length === 0 && <p className="admin-empty">没有匹配的资源</p>}
              {filteredResources.map((resource) => (
                <div className="admin-res-row" key={resource.id}>
                  <div className="admin-res-row__cover">
                    {resource.cover ? (
                      <img src={resource.cover} alt="" />
                    ) : (
                      <span>📁</span>
                    )}
                  </div>
                  <div className="admin-res-row__body">
                    <div className="admin-res-row__meta">
                      <span className="admin-res-status" style={{ "--c": STATUS_COLORS[resource.publish_status] } as React.CSSProperties}>
                        {STATUS_LABELS[resource.publish_status]}
                      </span>
                      <span className="admin-res-cat">{resource.category}</span>
                    </div>
                    <h3 className="admin-res-row__title">{resource.title}</h3>
                    <p className="admin-res-row__summary">{resource.summary}</p>
                  </div>
                  <div className="admin-res-row__actions">
                    <button type="button" className="adm-btn adm-btn--sm" onClick={() => handleEdit(resource)}>编辑</button>
                    {resource.publish_status !== "published" && (
                      <button type="button" className="adm-btn adm-btn--sm adm-btn--green" onClick={() => handleQuickStatus(resource.id, "published")}>发布</button>
                    )}
                    {resource.publish_status !== "offline" && (
                      <button type="button" className="adm-btn adm-btn--sm adm-btn--warn" onClick={() => handleQuickStatus(resource.id, "offline")}>下线</button>
                    )}
                    <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => handleDelete(resource.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── 新增 / 编辑 ─────────────────────────── */}
        {tab === "form" && (
          <div className="admin-form-wrap">
            <form className="admin-form-grid" onSubmit={handleSubmit}>
              <div className="admin-form-section">
                <h2 className="admin-form-section__title">基础信息</h2>
                <div className="adm-field">
                  <label htmlFor="title">标题 *</label>
                  <input id="title" name="title" value={form.title} onChange={handleInputChange} required placeholder="资源标题" />
                </div>
                <div className="adm-field">
                  <label htmlFor="slug">Slug *</label>
                  <input id="slug" name="slug" value={form.slug} onChange={handleInputChange} required placeholder="url-friendly-slug" />
                </div>
                <div className="adm-field">
                  <label htmlFor="summary">摘要 *</label>
                  <textarea id="summary" name="summary" value={form.summary} onChange={handleInputChange} required placeholder="简短描述资源内容" />
                </div>
                <div className="adm-field-row">
                  <div className="adm-field">
                    <label htmlFor="category">分类 *</label>
                    <input id="category" name="category" value={form.category} onChange={handleInputChange} required />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="tags">标签（逗号分隔）</label>
                    <input id="tags" name="tags" value={form.tags} onChange={handleInputChange} />
                  </div>
                </div>
              </div>

              <div className="admin-form-section">
                <h2 className="admin-form-section__title">链接与封面</h2>
                <div className="adm-field">
                  <label htmlFor="quark_url">夸克链接 *</label>
                  <input id="quark_url" name="quark_url" value={form.quark_url} onChange={handleInputChange} required placeholder="https://pan.quark.cn/..." />
                </div>
                <div className="adm-field-row">
                  <div className="adm-field">
                    <label htmlFor="extract_code">提取码</label>
                    <input id="extract_code" name="extract_code" value={form.extract_code} onChange={handleInputChange} />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="publish_status">状态</label>
                    <select id="publish_status" name="publish_status" value={form.publish_status} onChange={handleInputChange}>
                      <option value="draft">草稿</option>
                      <option value="published">已发布</option>
                      <option value="offline">已下线</option>
                    </select>
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="cover">封面图 URL *</label>
                  <input id="cover" name="cover" value={form.cover} onChange={handleInputChange} required placeholder="https://..." />
                </div>
                <div className="adm-field">
                  <label htmlFor="published_at">发布时间</label>
                  <input id="published_at" name="published_at" type="datetime-local" value={form.published_at} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="admin-form-actions">
                <button className="adm-btn adm-btn--primary" disabled={isPending} type="submit">
                  {isPending ? "保存中..." : form.id ? "更新资源" : "新增资源"}
                </button>
                <button className="adm-btn" type="button" onClick={() => setForm(emptyForm)}>清空表单</button>
                {form.id && (
                  <button className="adm-btn" type="button" onClick={() => { setForm(emptyForm); setTab("resources"); }}>取消编辑</button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ─── 批量导入 ─────────────────────────────── */}
        {tab === "import" && (
          <div className="admin-import-wrap">
            <div className="admin-panel admin-panel--wide">
              <div className="admin-panel__title">CSV 批量导入</div>
              <p className="admin-import__desc">
                支持新增和覆盖更新（upsert）。必填列：<code>title, slug, summary, category, tags, quark_url, extract_code, publish_status, published_at</code>
              </p>
              <div className="adm-field">
                <label htmlFor="csv-file">上传 CSV 文件</label>
                <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
              </div>
              <div className="adm-field">
                <label htmlFor="csv-text">或直接粘贴 CSV 内容</label>
                <textarea id="csv-text" value={csv} onChange={(e) => setCsv(e.target.value)} rows={12} placeholder="title,slug,summary,category,..." />
              </div>
              <div className="admin-form-actions">
                <button className="adm-btn adm-btn--primary" type="button" onClick={handleImport} disabled={isPending || !csv.trim()}>
                  {isPending ? "导入中..." : "执行导入"}
                </button>
                <button className="adm-btn" type="button" onClick={() => setCsv("")}>清空</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── 失效反馈 ─────────────────────────────── */}
        {tab === "feedback" && (
          <div className="admin-feedback">
            <div className="admin-feedback__summary">
              共 {feedback.length} 条，未处理 <strong>{feedback.filter((f) => !f.resolved).length}</strong> 条
            </div>
            <div className="admin-res-list">
              {feedback.length === 0 && <p className="admin-empty">暂无反馈记录</p>}
              {feedback.map((item) => (
                <div className={`admin-res-row admin-fb-row${item.resolved ? " admin-fb-row--resolved" : ""}`} key={item.id}>
                  <div className="admin-res-row__body">
                    <div className="admin-res-row__meta">
                      <span className="admin-fb-reason">{FEEDBACK_REASON_LABELS[item.reason] || item.reason}</span>
                      {item.resolved && <span className="admin-fb-resolved">已处理</span>}
                    </div>
                    <h3 className="admin-res-row__title">
                      <Link href={`/resource/${item.resource_slug}`}>{item.resource_title}</Link>
                    </h3>
                    {item.note && <p className="admin-res-row__summary">{item.note}</p>}
                    <p className="admin-fb-time">{new Date(item.created_at).toLocaleString("zh-CN")}</p>
                  </div>
                  <div className="admin-res-row__actions">
                    <Link href={`/resource/${item.resource_slug}`} className="adm-btn adm-btn--sm" target="_blank">查看</Link>
                    {!item.resolved && (
                      <>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--warn"
                          onClick={() => {
                            const r = resources.find((r) => r.id === item.resource_id);
                            if (r) handleQuickStatus(r.id, "offline");
                            handleResolveFeedback(item.id);
                          }}>
                          下线资源
                        </button>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--green" onClick={() => handleResolveFeedback(item.id)}>
                          标记处理
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
