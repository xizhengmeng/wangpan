"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { AnalyticsPeriod, AnalyticsPeriodPoint } from "@/lib/analytics";
import { CategoryNode, Channel, ContentStructure, Feedback, Resource, TopicNode } from "@/lib/types";

type Tab = "dashboard" | "resources" | "form" | "import" | "feedback" | "structure";
type StructurePanel = null | "site" | "channel" | "category" | "topic";

interface RankedResource { resourceId: string; title: string; slug: string; count: number }

interface DashboardPeriodData {
  label: string;
  rangeLabel: string;
  granularityLabel: string;
  visits: number;
  searches: number;
  clicks: number;
  downloads: number;
  visitChange: number;
  searchChange: number;
  clickChange: number;
  downloadChange: number;
  points: AnalyticsPeriodPoint[];
  topQueries: Array<{ query: string; count: number }>;
  topClickedResources: RankedResource[];
  topDownloadedResources: RankedResource[];
}

interface AdminResourcesClientProps {
  initialResources: Resource[];
  overviewMetrics: Array<{ label: string; value: string }>;
  dashboardPeriods: Record<AnalyticsPeriod, DashboardPeriodData>;
  siteProfile: ContentStructure["site_profile"];
  initialChannels: Channel[];
  initialCategories: CategoryNode[];
  initialTopics: TopicNode[];
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

const emptyResForm = {
  id: "",
  title: "",
  slug: "",
  summary: "",
  channel_id: "",
  category_id: "",
  topic_id: "",
  category: "",
  tags: "",
  cover: "",
  quark_url: "",
  extract_code: "",
  publish_status: "draft",
  published_at: new Date().toISOString().slice(0, 16),
  meta: {} as Record<string, string>,
};

const emptyChannelForm = { id: "", name: "", slug: "", description: "", sort_order: 0, featured: false, status: "active" as "active" | "hidden" };
const emptyCategoryForm = { id: "", channel_id: "", name: "", slug: "", description: "", sort_order: 0, featured: false, status: "active" as "active" | "hidden" };
const emptyTopicForm = { id: "", category_id: "", name: "", slug: "", summary: "", sort_order: 0, featured: false, status: "active" as "active" | "hidden", field_schema: "" };

function formatDelta(value: number) {
  if (value === 0) {
    return "与上一周期持平";
  }

  return `${value > 0 ? "+" : ""}${value}%`;
}

function buildLinePath(values: number[], width: number, height: number, maxValue: number) {
  if (values.length === 0) {
    return "";
  }

  const safeMax = Math.max(maxValue, 1);
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = Number((index * stepX).toFixed(2));
      const y = Number((height - (value / safeMax) * height).toFixed(2));
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, maxValue: number) {
  if (values.length === 0) {
    return "";
  }

  const linePath = buildLinePath(values, width, height, maxValue);
  const firstX = 0;
  const lastX = values.length === 1 ? 0 : width;
  return `${linePath} L${lastX} ${height} L${firstX} ${height} Z`;
}

function DashboardChart({ points }: { points: AnalyticsPeriodPoint[] }) {
  const width = 720;
  const height = 240;
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.visits, point.clicks, point.downloads])
  );
  const visits = points.map((point) => point.visits);
  const clicks = points.map((point) => point.clicks);
  const downloads = points.map((point) => point.downloads);

  return (
    <div className="admin-chart">
      <div className="admin-chart__legend">
        <span><i style={{ "--legend-color": "#2563eb" } as React.CSSProperties} />访问</span>
        <span><i style={{ "--legend-color": "#14b8a6" } as React.CSSProperties} />点击</span>
        <span><i style={{ "--legend-color": "#f59e0b" } as React.CSSProperties} />下载</span>
      </div>
      <div className="admin-chart__canvas">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => {
            const y = (height / 3) * step;
            return <line key={step} x1="0" y1={y} x2={width} y2={y} className="admin-chart__grid" />;
          })}
          <path d={buildAreaPath(visits, width, height, maxValue)} className="admin-chart__area" />
          <path d={buildLinePath(visits, width, height, maxValue)} className="admin-chart__line admin-chart__line--visits" />
          <path d={buildLinePath(clicks, width, height, maxValue)} className="admin-chart__line admin-chart__line--clicks" />
          <path d={buildLinePath(downloads, width, height, maxValue)} className="admin-chart__line admin-chart__line--downloads" />
        </svg>
      </div>
      <div className="admin-chart__axis">
        {points.map((point) => (
          <span key={point.key}>{point.shortLabel}</span>
        ))}
      </div>
    </div>
  );
}

export function AdminResourcesClient({
  initialResources,
  overviewMetrics,
  dashboardPeriods,
  siteProfile,
  initialChannels,
  initialCategories,
  initialTopics,
  initialFeedback,
}: AdminResourcesClientProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboardPeriod, setDashboardPeriod] = useState<AnalyticsPeriod>("week");
  const [structurePanel, setStructurePanel] = useState<StructurePanel>(null);
  const router = useRouter();
  const [resources, setResources] = useState(initialResources);
  const [form, setForm] = useState(emptyResForm);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("all");
  const [titleSearch, setTitleSearch] = useState("");
  const [feedback, setFeedback] = useState(initialFeedback);

  /* ── Structure state ── */
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [categories, setCategories] = useState<CategoryNode[]>(initialCategories);
  const [topics, setTopics] = useState<TopicNode[]>(initialTopics);
  const [structureLoaded, setStructureLoaded] = useState(true);
  const [collapsedChannels, setCollapsedChannels] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [siteProfileForm, setSiteProfileForm] = useState({
    name: siteProfile.name,
    tagline: siteProfile.tagline,
    short_link: siteProfile.short_link,
    positioning: siteProfile.positioning,
    featured_message: siteProfile.featured_message || "",
    hot_searches: (siteProfile.hot_searches || []).join("\n"),
  });
  const [channelForm, setChannelForm] = useState(emptyChannelForm);

  function toggleChannel(id: string) {
    setCollapsedChannels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleCategory(id: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [topicForm, setTopicForm] = useState(emptyTopicForm);

  /* ── Load structure when tab is opened ── */
  const loadStructure = useCallback(async () => {
    const res = await fetch("/api/admin/structure");
    if (!res.ok) return;
    const data = await res.json() as ContentStructure;
    setSiteProfileForm({
      name: data.site_profile.name,
      tagline: data.site_profile.tagline,
      short_link: data.site_profile.short_link,
      positioning: data.site_profile.positioning,
      featured_message: data.site_profile.featured_message || "",
      hot_searches: (data.site_profile.hot_searches || []).join("\n"),
    });
    setChannels(data.channels);
    setCategories(data.categories);
    setTopics(data.topics);
    setStructureLoaded(true);
  }, []);

  useEffect(() => {
    if (tab === "structure" && !structureLoaded) {
      void loadStructure();
    }
  }, [tab, structureLoaded, loadStructure]);

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

  const channelOptions = useMemo(() => channels, [channels]);

  const categoryOptions = useMemo(
    () =>
      categories.filter((category) => category.channel_id === form.channel_id),
    [categories, form.channel_id]
  );

  const topicOptions = useMemo(
    () =>
      topics.filter((topic) => topic.category_id === form.category_id),
    [topics, form.category_id]
  );

  const selectedTopicSchema = useMemo(
    () => topics.find((t) => t.id === form.topic_id)?.field_schema ?? [],
    [topics, form.topic_id]
  );

  const currentDashboard = dashboardPeriods[dashboardPeriod];
  const dashboardMetricCards = useMemo(
    () => [
      ...overviewMetrics.slice(0, 2),
      { label: `${currentDashboard.rangeLabel}访问量`, value: String(currentDashboard.visits), delta: currentDashboard.visitChange },
      { label: `${currentDashboard.rangeLabel}搜索量`, value: String(currentDashboard.searches), delta: currentDashboard.searchChange },
      { label: `${currentDashboard.rangeLabel}点击量`, value: String(currentDashboard.clicks), delta: currentDashboard.clickChange },
      { label: `${currentDashboard.rangeLabel}下载量`, value: String(currentDashboard.downloads), delta: currentDashboard.downloadChange },
    ],
    [currentDashboard, overviewMetrics]
  );

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

  function handleChannelSelect(channelId: string) {
    setForm((current) => ({
      ...current,
      channel_id: channelId,
      category_id: "",
      topic_id: "",
      category: "",
    }));
  }

  function handleCategorySelect(categoryId: string) {
    const selectedCategory = categories.find((item) => item.id === categoryId);

    if (!selectedCategory) {
      setForm((current) => ({
        ...current,
        category_id: "",
        topic_id: "",
        category: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      channel_id: selectedCategory.channel_id,
      category_id: selectedCategory.id,
      topic_id: "",
      category: selectedCategory.name,
    }));
  }

  function handleTopicSelect(topicId: string) {
    setForm((current) => ({
      ...current,
      topic_id: topicId,
      meta: {},
    }));
  }

  function handleMetaChange(key: string, value: string) {
    setForm((current) => ({ ...current, meta: { ...current.meta, [key]: value } }));
  }

  function handleEdit(resource: Resource) {
    const matchedTopic = resource.topic_ids?.[0]
      ? topics.find((item) => item.id === resource.topic_ids?.[0])
      : null;
    const matchedCategory = resource.category_id
      ? categories.find((item) => item.id === resource.category_id)
      : matchedTopic
        ? categories.find((item) => item.id === matchedTopic.category_id)
        : categories.find((item) => item.name === resource.category);

    setForm({
      id: resource.id,
      title: resource.title,
      slug: resource.slug,
      summary: resource.summary,
      channel_id: matchedCategory?.channel_id || resource.channel_id || "",
      category_id: matchedCategory?.id || resource.category_id || "",
      topic_id: matchedTopic?.id || resource.topic_ids?.[0] || "",
      category: matchedCategory?.name || resource.category,
      tags: resource.tags.join(", "),
      cover: resource.cover,
      quark_url: resource.quark_url,
      extract_code: resource.extract_code || "",
      publish_status: resource.publish_status,
      published_at: resource.published_at.slice(0, 16),
      meta: resource.meta || {},
    });
    setTab("form");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const { topic_id, ...restForm } = form;
      const payload = {
        ...restForm,
        topic_ids: topic_id ? [topic_id] : [],
        tags: form.tags.split(/[|,，]/).map((t) => t.trim()).filter(Boolean),
        published_at: new Date(form.published_at).toISOString(),
        meta: Object.keys(form.meta).length > 0 ? form.meta : undefined,
      };
      const method = form.id ? "PUT" : "POST";
      const url = form.id ? `/api/admin/resources/${form.id}` : "/api/admin/resources";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { notify("err", data.error || "保存失败"); return; }
      await refreshResources();
      setForm(emptyResForm);
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

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
  }

  /* ── Structure handlers ── */
  async function handleSaveStructure(type: "site_profile" | "channel" | "category" | "topic", data: Record<string, unknown>) {
    let payload: Record<string, unknown> = { type, ...data };
    // parse field_schema JSON string before sending
    if (type === "topic" && typeof data.field_schema === "string") {
      const raw = (data.field_schema as string).trim();
      if (raw) {
        try { payload = { ...payload, field_schema: JSON.parse(raw) }; }
        catch { notify("err", "字段配置 JSON 格式有误"); return; }
      } else {
        const { field_schema: _fs, ...rest } = payload;
        void _fs;
        payload = rest;
      }
    }
    const res = await fetch("/api/admin/structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { notify("err", "保存失败"); return; }
    notify("ok", "保存成功");
    await loadStructure();
  }

  async function handleDeleteStructure(type: "channel" | "category" | "topic", id: string) {
    if (!confirm("确认删除？关联的子项也会被一并删除。")) return;
    const res = await fetch(`/api/admin/structure?type=${type}&id=${id}`, { method: "DELETE" });
    if (!res.ok) { notify("err", "删除失败"); return; }
    notify("ok", "已删除");
    await loadStructure();
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

  const TABS: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: "dashboard", label: "统计看板", icon: "📊" },
    { key: "resources", label: "资源管理", icon: "📦", badge: resources.length },
    { key: "form", label: form.id ? "编辑资源" : "新增资源", icon: form.id ? "✏️" : "➕" },
    { key: "import", label: "批量导入", icon: "📤" },
    { key: "structure", label: "导航与分类", icon: "🗂" },
    { key: "feedback", label: "失效反馈", icon: "🚨", badge: feedback.filter((f) => !f.resolved).length },
  ];

  return (
    <div className="adm-layout">
      {/* ── Left sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar__brand">
          <Link href="/" className="adm-sidebar__logo">夸克网盘资料</Link>
          <p className="adm-sidebar__sub">运营后台</p>
        </div>

        <nav className="adm-sidebar__nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`adm-nav-item${tab === t.key ? " adm-nav-item--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span className="adm-nav-item__icon">{t.icon}</span>
              <span className="adm-nav-item__label">{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="adm-nav-item__badge">{t.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="adm-sidebar__footer">
          <button type="button" className="adm-nav-item adm-nav-item--logout" onClick={handleLogout}>
            <span className="adm-nav-item__icon">↩</span>
            <span className="adm-nav-item__label">退出登录</span>
          </button>
          <Link href="/" className="adm-nav-item">
            <span className="adm-nav-item__icon">🌐</span>
            <span className="adm-nav-item__label">查看前台</span>
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="adm-main">
        {/* Toast */}
        {message && (
          <div className={`admin-toast admin-toast--${message.type}`}>{message.text}</div>
        )}

        {/* ─── 统计看板 ─────────────────────────── */}
        {tab === "dashboard" && (
          <div className="adm-page">
            <div className="adm-page__head admin-dashboard__head">
              <div>
                <h1>统计看板</h1>
                <p className="adm-page__desc">
                  查看访问、搜索、点击和下载在不同周期下的变化。日视图按小时，周/月视图按天。
                </p>
              </div>
              <div className="admin-period-switch">
                {(["day", "week", "month"] as AnalyticsPeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`admin-period-switch__btn${dashboardPeriod === period ? " admin-period-switch__btn--active" : ""}`}
                    onClick={() => setDashboardPeriod(period)}
                  >
                    {period === "day" ? "天" : period === "week" ? "周" : "月"}
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-metrics">
              {dashboardMetricCards.map((m) => (
                <div className="admin-metric-card" key={m.label}>
                  <strong>{m.value}</strong>
                  <span>{m.label}</span>
                  {"delta" in m && typeof m.delta === "number" && (
                    <em className={`admin-metric-card__delta${m.delta < 0 ? " admin-metric-card__delta--down" : ""}`}>
                      {formatDelta(m.delta)}
                    </em>
                  )}
                </div>
              ))}
            </div>

            <div className="admin-panel admin-panel--wide">
              <div className="admin-panel__title">
                访问变化趋势
                <small>{currentDashboard.rangeLabel} · {currentDashboard.granularityLabel}</small>
              </div>
              <div className="admin-trend">
                <div className="admin-trend__summary">
                  <div className="admin-trend__summary-item">
                    <span>访问</span>
                    <strong>{currentDashboard.visits}</strong>
                    <small>{formatDelta(currentDashboard.visitChange)}</small>
                  </div>
                  <div className="admin-trend__summary-item">
                    <span>点击</span>
                    <strong>{currentDashboard.clicks}</strong>
                    <small>{formatDelta(currentDashboard.clickChange)}</small>
                  </div>
                  <div className="admin-trend__summary-item">
                    <span>下载</span>
                    <strong>{currentDashboard.downloads}</strong>
                    <small>{formatDelta(currentDashboard.downloadChange)}</small>
                  </div>
                </div>
                <DashboardChart points={currentDashboard.points} />
              </div>
            </div>

            <div className="admin-dashboard__grid">
              <div className="admin-panel">
                <div className="admin-panel__title">搜索关键词排行 <small>{currentDashboard.rangeLabel}</small></div>
                {currentDashboard.topQueries.length > 0 ? currentDashboard.topQueries.map((item, index) => (
                  <div className="admin-rank-row" key={item.query}>
                    <span className="admin-rank-row__index">{index + 1}</span>
                    <span className="admin-rank-row__label">{item.query}</span>
                    <span className="admin-rank-row__count">{item.count} 次</span>
                  </div>
                )) : <p className="admin-empty">当前周期暂无搜索数据</p>}
              </div>

              <div className="admin-panel">
                <div className="admin-panel__title">点击内容排行 <small>{currentDashboard.rangeLabel}</small></div>
                {currentDashboard.topClickedResources.length > 0 ? currentDashboard.topClickedResources.map((item, index) => (
                  <div className="admin-rank-row" key={item.resourceId}>
                    <span className="admin-rank-row__index">{index + 1}</span>
                    <Link href={`/resource/${item.slug}`} className="admin-rank-row__label admin-rank-row__link">{item.title}</Link>
                    <span className="admin-rank-row__count">{item.count} 次</span>
                  </div>
                )) : <p className="admin-empty">当前周期暂无点击数据</p>}
              </div>

              <div className="admin-panel">
                <div className="admin-panel__title">下载内容排行 <small>{currentDashboard.rangeLabel}</small></div>
                {currentDashboard.topDownloadedResources.length > 0 ? currentDashboard.topDownloadedResources.map((item, index) => (
                  <div className="admin-rank-row" key={item.resourceId}>
                    <span className="admin-rank-row__index">{index + 1}</span>
                    <Link href={`/resource/${item.slug}`} className="admin-rank-row__label admin-rank-row__link">{item.title}</Link>
                    <span className="admin-rank-row__count">{item.count} 次</span>
                  </div>
                )) : <p className="admin-empty">当前周期暂无下载数据</p>}
              </div>
            </div>
          </div>
        )}

        {/* ─── 资源管理 ─────────────────────────── */}
        {tab === "resources" && (
          <div className="adm-page">
            <div className="adm-page__head">
              <h1>资源管理</h1>
              <button type="button" className="adm-btn adm-btn--primary" onClick={() => { setForm(emptyResForm); setTab("form"); }}>+ 新增资源</button>
            </div>
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
          <div className="adm-page">
            <div className="adm-page__head">
              <h1>{form.id ? "编辑资源" : "新增资源"}</h1>
              {form.id && <button className="adm-btn" type="button" onClick={() => { setForm(emptyResForm); setTab("resources"); }}>取消</button>}
            </div>
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
                <div className="adm-field-row adm-field-row--triple">
                  <div className="adm-field">
                    <label htmlFor="channel_id">频道 *</label>
                    <select
                      id="channel_id"
                      name="channel_id"
                      value={form.channel_id}
                      onChange={(e) => handleChannelSelect(e.target.value)}
                      required
                    >
                      <option value="">先选择频道</option>
                      {channelOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}{option.status === "hidden" ? "（隐藏）" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="category_id">栏目 *</label>
                    <select
                      id="category_id"
                      name="category_id"
                      value={form.category_id}
                      onChange={(e) => handleCategorySelect(e.target.value)}
                      required
                      disabled={!form.channel_id}
                    >
                      <option value="">{form.channel_id ? "再选择栏目" : "请先选频道"}</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}{option.status === "hidden" ? "（隐藏）" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="topic_id">专题 *</label>
                    <select
                      id="topic_id"
                      name="topic_id"
                      value={form.topic_id}
                      onChange={(e) => handleTopicSelect(e.target.value)}
                      required
                      disabled={!form.category_id}
                    >
                      <option value="">{form.category_id ? "最后选择专题" : "请先选栏目"}</option>
                      {topicOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}{option.status === "hidden" ? "（隐藏）" : ""}
                        </option>
                      ))}
                    </select>
                    <small className="adm-field__hint">
                      {form.topic_id
                        ? `已绑定：${channels.find((item) => item.id === form.channel_id)?.name || "未分组频道"} / ${categories.find((item) => item.id === form.category_id)?.name || form.category} / ${topics.find((item) => item.id === form.topic_id)?.name || form.topic_id}`
                        : "按 频道 → 栏目 → 专题 逐级选择。"}
                    </small>
                  </div>
                </div>
                {selectedTopicSchema.length > 0 && (
                  <div className="admin-form-section">
                    <h2 className="admin-form-section__title">专题扩展字段</h2>
                    <div className="adm-field-row">
                      {selectedTopicSchema.map((field) => (
                        <div className="adm-field" key={field.key}>
                          <label>{field.label}</label>
                          {field.type === "select" && field.options ? (
                            <select
                              value={form.meta[field.key] || ""}
                              onChange={(e) => handleMetaChange(field.key, e.target.value)}
                            >
                              <option value="">请选择{field.label}</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={form.meta[field.key] || ""}
                              onChange={(e) => handleMetaChange(field.key, e.target.value)}
                              placeholder={field.label}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="adm-field">
                  <label htmlFor="tags">标签（逗号分隔）</label>
                  <input id="tags" name="tags" value={form.tags} onChange={handleInputChange} />
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
                <button className="adm-btn" type="button" onClick={() => setForm(emptyResForm)}>清空表单</button>
              </div>
            </form>
            </div>
          </div>
        )}

        {/* ─── 批量导入 ─────────────────────────── */}
        {tab === "import" && (
          <div className="adm-page">
            <div className="adm-page__head"><h1>批量导入</h1></div>
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
          </div>
        )}

        {/* ─── 失效反馈 ─────────────────────────── */}
        {tab === "feedback" && (
          <div className="adm-page">
            <div className="adm-page__head">
              <h1>失效反馈</h1>
              <span className="adm-page__meta">共 {feedback.length} 条，未处理 <strong>{feedback.filter((f) => !f.resolved).length}</strong> 条</span>
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

        {/* ─── 导航与分类 ─────────────────────── */}
        {tab === "structure" && (
          <div className="adm-page adm-page--wide">
            <div className="adm-page__head">
              <div>
                <h1>导航与分类</h1>
                <p className="adm-page__desc">频道 → 栏目 → 专题，三级从属结构</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="adm-btn adm-btn--sm"
                  onClick={() => setStructurePanel("site")}
                >
                  站点配置
                </button>
                <button type="button" className="adm-btn adm-btn--sm"
                  onClick={() => {
                    const allCh = new Set(channels.map((c) => c.id));
                    const allCat = new Set(categories.map((c) => c.id));
                    const anyOpen = collapsedChannels.size < allCh.size || collapsedCategories.size < allCat.size;
                    if (anyOpen) { setCollapsedChannels(allCh); setCollapsedCategories(allCat); }
                    else { setCollapsedChannels(new Set()); setCollapsedCategories(new Set()); }
                  }}>
                  {collapsedChannels.size + collapsedCategories.size > 0 ? "全部展开" : "全部折叠"}
                </button>
                <button type="button" className="adm-btn adm-btn--primary"
                  onClick={() => { setChannelForm(emptyChannelForm); setStructurePanel("channel"); }}>
                  + 新增频道
                </button>
              </div>
            </div>

            <div className="stree-layout">
              {/* ── 左侧层级树 ── */}
              <div className="stree">
                {channels.length === 0 && (
                  <div className="stree-empty">
                    <p>还没有频道，点击右上角「+ 新增频道」开始创建</p>
                  </div>
                )}

                {channels.map((ch) => {
                  const chCats = categories.filter((c) => c.channel_id === ch.id);
                  const chCollapsed = collapsedChannels.has(ch.id);
                  return (
                    <div className="stree-channel" key={ch.id}>
                      {/* 频道行 */}
                      <div className="stree-row stree-row--channel">
                        <button type="button" className="stree-toggle" onClick={() => toggleChannel(ch.id)}
                          title={chCollapsed ? "展开" : "折叠"}>
                          <span className={`stree-chevron${chCollapsed ? " stree-chevron--collapsed" : ""}`}>▾</span>
                          <span className="stree-toggle__count">{chCats.length}</span>
                        </button>
                        <span className="stree-row__icon">📡</span>
                        <div className="stree-row__body">
                          <span className="stree-row__name">{ch.name}</span>
                          <span className="stree-row__slug">{ch.slug}</span>
                          {ch.status === "hidden" && <span className="stree-tag stree-tag--hidden">隐藏</span>}
                          {ch.featured && <span className="stree-tag stree-tag--featured">热门</span>}
                        </div>
                        <div className="stree-row__actions">
                          <button type="button" className="stree-action stree-action--add"
                            title="新增栏目"
                            onClick={() => {
                              setCategoryForm({ ...emptyCategoryForm, channel_id: ch.id });
                              setStructurePanel("category");
                            }}>+ 栏目</button>
                          <button type="button" className="stree-action"
                            onClick={() => { setChannelForm({ id: ch.id, name: ch.name, slug: ch.slug, description: ch.description, sort_order: ch.sort, featured: ch.featured ?? false, status: ch.status }); setStructurePanel("channel"); }}>编辑</button>
                          <button type="button" className="stree-action stree-action--del"
                            onClick={() => handleDeleteStructure("channel", ch.id)}>删除</button>
                        </div>
                      </div>

                      {/* 栏目行 */}
                      {!chCollapsed && chCats.length === 0 && (
                        <div className="stree-hint">暂无栏目，点击「+ 栏目」添加</div>
                      )}
                      {!chCollapsed && chCats.map((cat, catIdx) => {
                        const catTopics = topics.filter((t) => t.category_id === cat.id);
                        const isLastCat = catIdx === chCats.length - 1;
                        const catCollapsed = collapsedCategories.has(cat.id);
                        return (
                          <div className={`stree-cat-block${isLastCat ? " stree-cat-block--last" : ""}`} key={cat.id}>
                            <div className="stree-row stree-row--category">
                              <button type="button" className="stree-toggle stree-toggle--sm" onClick={() => toggleCategory(cat.id)}>
                                <span className={`stree-chevron${catCollapsed ? " stree-chevron--collapsed" : ""}`}>▾</span>
                                <span className="stree-toggle__count">{catTopics.length}</span>
                              </button>
                              <span className="stree-row__icon">📂</span>
                              <div className="stree-row__body">
                                <span className="stree-row__name">{cat.name}</span>
                                <span className="stree-row__slug">{cat.slug}</span>
                                {cat.status === "hidden" && <span className="stree-tag stree-tag--hidden">隐藏</span>}
                              </div>
                              <div className="stree-row__actions">
                                <button type="button" className="stree-action stree-action--add"
                                  onClick={() => {
                                    setTopicForm({ ...emptyTopicForm, category_id: cat.id });
                                    setStructurePanel("topic");
                                  }}>+ 专题</button>
                                <button type="button" className="stree-action"
                                  onClick={() => { setCategoryForm({ id: cat.id, channel_id: cat.channel_id, name: cat.name, slug: cat.slug, description: cat.description, sort_order: cat.sort, featured: cat.featured ?? false, status: cat.status }); setStructurePanel("category"); }}>编辑</button>
                                <button type="button" className="stree-action stree-action--del"
                                  onClick={() => handleDeleteStructure("category", cat.id)}>删除</button>
                              </div>
                            </div>

                            {/* 专题行 */}
                            {!catCollapsed && catTopics.length === 0 && (
                              <div className="stree-hint stree-hint--topic">暂无专题</div>
                            )}
                            {!catCollapsed && catTopics.map((topic, topicIdx) => {
                              const isLastTopic = topicIdx === catTopics.length - 1;
                              return (
                                <div className={`stree-row stree-row--topic${isLastTopic ? " stree-row--last" : ""}`} key={topic.id}>
                                  <span className="stree-row__icon">📄</span>
                                  <div className="stree-row__body">
                                    <span className="stree-row__name">{topic.name}</span>
                                    <span className="stree-row__slug">{topic.slug}</span>
                                    {topic.status === "hidden" && <span className="stree-tag stree-tag--hidden">隐藏</span>}
                                    {topic.featured && <span className="stree-tag stree-tag--featured">精选</span>}
                                  </div>
                                  <div className="stree-row__actions">
                                    <button type="button" className="stree-action"
                                      onClick={() => { setTopicForm({ id: topic.id, category_id: topic.category_id, name: topic.name, slug: topic.slug, summary: topic.summary, sort_order: topic.sort, featured: topic.featured ?? false, status: topic.status, field_schema: topic.field_schema ? JSON.stringify(topic.field_schema, null, 2) : "" }); setStructurePanel("topic"); }}>编辑</button>
                                    <button type="button" className="stree-action stree-action--del"
                                      onClick={() => handleDeleteStructure("topic", topic.id)}>删除</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* ── 右侧表单面板 ── */}
              {structurePanel !== null && (
                <div className="stree-panel">
                  {structurePanel === "site" && (
                    <>
                      <div className="stree-panel__head">
                        <span className="stree-panel__icon">⚙️</span>
                        <span className="stree-panel__title">站点配置</span>
                        <button type="button" className="stree-panel__close" onClick={() => setStructurePanel(null)}>✕</button>
                      </div>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await handleSaveStructure("site_profile", {
                            ...siteProfileForm,
                            hot_searches: siteProfileForm.hot_searches
                              .split(/\r?\n|,|，/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          });
                          setStructurePanel(null);
                        }}
                      >
                        <div className="adm-field">
                          <label>站点名称</label>
                          <input value={siteProfileForm.name} onChange={(e) => setSiteProfileForm((current) => ({ ...current, name: e.target.value }))} />
                        </div>
                        <div className="adm-field">
                          <label>站点副标题</label>
                          <input value={siteProfileForm.tagline} onChange={(e) => setSiteProfileForm((current) => ({ ...current, tagline: e.target.value }))} />
                        </div>
                        <div className="adm-field">
                          <label>站点定位</label>
                          <textarea rows={3} value={siteProfileForm.positioning} onChange={(e) => setSiteProfileForm((current) => ({ ...current, positioning: e.target.value }))} />
                        </div>
                        <div className="adm-field">
                          <label>首页提示语</label>
                          <input value={siteProfileForm.featured_message} onChange={(e) => setSiteProfileForm((current) => ({ ...current, featured_message: e.target.value }))} />
                        </div>
                        <div className="adm-field">
                          <label>热门搜索</label>
                          <textarea
                            rows={6}
                            value={siteProfileForm.hot_searches}
                            onChange={(e) => setSiteProfileForm((current) => ({ ...current, hot_searches: e.target.value }))}
                            placeholder={"考研\nPPT 模板\nPython"}
                          />
                          <small className="adm-field__hint">每行一个词，也支持逗号分隔。首页热门搜索会优先使用这里的配置。</small>
                        </div>
                        <div className="adm-field">
                          <label>热门频道说明</label>
                          <small className="adm-field__hint">首页热门频道直接读取频道上的“热门频道（首页展示）”开关，这里无需重复配置。</small>
                        </div>
                        <div className="admin-form-actions">
                          <button className="adm-btn adm-btn--primary" type="submit">保存</button>
                          <button className="adm-btn" type="button" onClick={() => setStructurePanel(null)}>取消</button>
                        </div>
                      </form>
                    </>
                  )}

                  {structurePanel === "channel" && (
                    <>
                      <div className="stree-panel__head">
                        <span className="stree-panel__icon">📡</span>
                        <span className="stree-panel__title">{channelForm.id ? "编辑频道" : "新增频道"}</span>
                        <button type="button" className="stree-panel__close" onClick={() => setStructurePanel(null)}>✕</button>
                      </div>
                      <form onSubmit={async (e) => { e.preventDefault(); await handleSaveStructure("channel", channelForm); setChannelForm(emptyChannelForm); setStructurePanel(null); }}>
                        <div className="adm-field"><label>频道名称 *</label>
                          <input required value={channelForm.name} onChange={(e) => setChannelForm((c) => ({ ...c, name: e.target.value }))} placeholder="如：教育考试" /></div>
                        <div className="adm-field"><label>Slug *</label>
                          <input required value={channelForm.slug} onChange={(e) => setChannelForm((c) => ({ ...c, slug: e.target.value }))} placeholder="education-exam" /></div>
                        <div className="adm-field"><label>描述</label>
                          <textarea value={channelForm.description} onChange={(e) => setChannelForm((c) => ({ ...c, description: e.target.value }))} rows={2} /></div>
                        <div className="adm-field-row">
                          <div className="adm-field"><label>排序</label>
                            <input type="number" value={channelForm.sort_order} onChange={(e) => setChannelForm((c) => ({ ...c, sort_order: Number(e.target.value) }))} /></div>
                          <div className="adm-field"><label>状态</label>
                            <select value={channelForm.status} onChange={(e) => setChannelForm((c) => ({ ...c, status: e.target.value as "active" | "hidden" }))}>
                              <option value="active">显示</option><option value="hidden">隐藏</option>
                            </select></div>
                        </div>
                        <div className="adm-field adm-field--check"><label>
                          <input type="checkbox" checked={channelForm.featured} onChange={(e) => setChannelForm((c) => ({ ...c, featured: e.target.checked }))} />
                          设为热门频道（首页展示）
                        </label></div>
                        <div className="admin-form-actions">
                          <button className="adm-btn adm-btn--primary" type="submit">保存</button>
                          <button className="adm-btn" type="button" onClick={() => setStructurePanel(null)}>取消</button>
                        </div>
                      </form>
                    </>
                  )}

                  {structurePanel === "category" && (
                    <>
                      <div className="stree-panel__head">
                        <span className="stree-panel__icon">📂</span>
                        <span className="stree-panel__title">{categoryForm.id ? "编辑栏目" : "新增栏目"}</span>
                        <button type="button" className="stree-panel__close" onClick={() => setStructurePanel(null)}>✕</button>
                      </div>
                      {categoryForm.channel_id && (
                        <div className="stree-panel__breadcrumb">
                          <span>📡 {channels.find((c) => c.id === categoryForm.channel_id)?.name || categoryForm.channel_id}</span>
                          <span> → 栏目</span>
                        </div>
                      )}
                      <form onSubmit={async (e) => { e.preventDefault(); await handleSaveStructure("category", categoryForm); setCategoryForm(emptyCategoryForm); setStructurePanel(null); }}>
                        <div className="adm-field"><label>所属频道 *</label>
                          <select required value={categoryForm.channel_id} onChange={(e) => setCategoryForm((c) => ({ ...c, channel_id: e.target.value }))}>
                            <option value="">请选择频道</option>
                            {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                          </select></div>
                        <div className="adm-field"><label>栏目名称 *</label>
                          <input required value={categoryForm.name} onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))} placeholder="如：考研资料" /></div>
                        <div className="adm-field"><label>Slug *</label>
                          <input required value={categoryForm.slug} onChange={(e) => setCategoryForm((c) => ({ ...c, slug: e.target.value }))} placeholder="kaoyan" /></div>
                        <div className="adm-field"><label>描述</label>
                          <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((c) => ({ ...c, description: e.target.value }))} rows={2} /></div>
                        <div className="adm-field-row">
                          <div className="adm-field"><label>排序</label>
                            <input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm((c) => ({ ...c, sort_order: Number(e.target.value) }))} /></div>
                          <div className="adm-field"><label>状态</label>
                            <select value={categoryForm.status} onChange={(e) => setCategoryForm((c) => ({ ...c, status: e.target.value as "active" | "hidden" }))}>
                              <option value="active">显示</option><option value="hidden">隐藏</option>
                            </select></div>
                        </div>
                        <div className="adm-field adm-field--check"><label>
                          <input type="checkbox" checked={categoryForm.featured} onChange={(e) => setCategoryForm((c) => ({ ...c, featured: e.target.checked }))} />
                          设为精选栏目
                        </label></div>
                        <div className="admin-form-actions">
                          <button className="adm-btn adm-btn--primary" type="submit">保存</button>
                          <button className="adm-btn" type="button" onClick={() => setStructurePanel(null)}>取消</button>
                        </div>
                      </form>
                    </>
                  )}

                  {structurePanel === "topic" && (
                    <>
                      <div className="stree-panel__head">
                        <span className="stree-panel__icon">📄</span>
                        <span className="stree-panel__title">{topicForm.id ? "编辑专题" : "新增专题"}</span>
                        <button type="button" className="stree-panel__close" onClick={() => setStructurePanel(null)}>✕</button>
                      </div>
                      {topicForm.category_id && (() => {
                        const cat = categories.find((c) => c.id === topicForm.category_id);
                        const ch = channels.find((c) => c.id === cat?.channel_id);
                        return (
                          <div className="stree-panel__breadcrumb">
                            {ch && <span>📡 {ch.name} → </span>}
                            {cat && <span>📂 {cat.name} → </span>}
                            <span>专题</span>
                          </div>
                        );
                      })()}
                      <form onSubmit={async (e) => { e.preventDefault(); await handleSaveStructure("topic", topicForm); setTopicForm(emptyTopicForm); setStructurePanel(null); }}>
                        <div className="adm-field"><label>所属栏目 *</label>
                          <select required value={topicForm.category_id} onChange={(e) => setTopicForm((c) => ({ ...c, category_id: e.target.value }))}>
                            <option value="">请选择栏目</option>
                            {categories.map((cat) => {
                              const ch = channels.find((c) => c.id === cat.channel_id);
                              return <option key={cat.id} value={cat.id}>{ch ? `${ch.name} / ` : ""}{cat.name}</option>;
                            })}
                          </select></div>
                        <div className="adm-field"><label>专题名称 *</label>
                          <input required value={topicForm.name} onChange={(e) => setTopicForm((c) => ({ ...c, name: e.target.value }))} placeholder="如：考研数学" /></div>
                        <div className="adm-field"><label>Slug *</label>
                          <input required value={topicForm.slug} onChange={(e) => setTopicForm((c) => ({ ...c, slug: e.target.value }))} placeholder="kaoyan-math" /></div>
                        <div className="adm-field"><label>摘要介绍</label>
                          <textarea value={topicForm.summary} onChange={(e) => setTopicForm((c) => ({ ...c, summary: e.target.value }))} rows={2} /></div>
                        <div className="adm-field">
                          <label>扩展字段配置（JSON）</label>
                          <textarea
                            value={topicForm.field_schema}
                            onChange={(e) => setTopicForm((c) => ({ ...c, field_schema: e.target.value }))}
                            rows={6}
                            placeholder={'[{"key":"subject","label":"科目","type":"select","options":["语文","数学"]}]'}
                            style={{ fontFamily: "monospace", fontSize: 12 }}
                          />
                          <small className="adm-field__hint">留空表示不启用扩展筛选。格式：JSON 数组，每项含 key、label、type（select/text）、options（数组）。</small>
                        </div>
                        <div className="adm-field-row">
                          <div className="adm-field"><label>排序</label>
                            <input type="number" value={topicForm.sort_order} onChange={(e) => setTopicForm((c) => ({ ...c, sort_order: Number(e.target.value) }))} /></div>
                          <div className="adm-field"><label>状态</label>
                            <select value={topicForm.status} onChange={(e) => setTopicForm((c) => ({ ...c, status: e.target.value as "active" | "hidden" }))}>
                              <option value="active">显示</option><option value="hidden">隐藏</option>
                            </select></div>
                        </div>
                        <div className="adm-field adm-field--check"><label>
                          <input type="checkbox" checked={topicForm.featured} onChange={(e) => setTopicForm((c) => ({ ...c, featured: e.target.checked }))} />
                          设为精选专题
                        </label></div>
                        <div className="admin-form-actions">
                          <button className="adm-btn adm-btn--primary" type="submit">保存</button>
                          <button className="adm-btn" type="button" onClick={() => setStructurePanel(null)}>取消</button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
