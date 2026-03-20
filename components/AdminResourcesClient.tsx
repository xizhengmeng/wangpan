"use client";

import { ChangeEvent, FormEvent, useMemo, useState, useTransition } from "react";

import { Resource } from "@/lib/types";

interface AnalyticsItem {
  label: string;
  value: string;
}

interface AdminResourcesClientProps {
  initialResources: Resource[];
  metrics: AnalyticsItem[];
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
}

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
  published_at: new Date().toISOString().slice(0, 16)
};

export function AdminResourcesClient({
  initialResources,
  metrics,
  topQueries,
  noResultQueries
}: AdminResourcesClientProps) {
  const [resources, setResources] = useState(initialResources);
  const [form, setForm] = useState(emptyForm);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedResources = useMemo(
    () =>
      [...resources].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [resources]
  );

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function refreshResources() {
    const response = await fetch("/api/admin/resources");
    const data = (await response.json()) as { items: Resource[] };
    setResources(data.items);
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
      published_at: resource.published_at.slice(0, 16)
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      const payload = {
        ...form,
        tags: form.tags
          .split(/[|,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        published_at: new Date(form.published_at).toISOString()
      };
      const method = form.id ? "PUT" : "POST";
      const url = form.id ? `/api/admin/resources/${form.id}` : "/api/admin/resources";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "保存失败");
        return;
      }

      await refreshResources();
      resetForm();
      setMessage("资源已保存");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        setMessage("删除失败");
        return;
      }

      await refreshResources();
      setMessage("资源已删除");
    });
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ""));
    };
    reader.readAsText(file);
  }

  function handleImport() {
    startTransition(async () => {
      const response = await fetch("/api/admin/resources/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          csv,
          mode: "upsert"
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "导入失败");
        return;
      }

      await refreshResources();
      setMessage(
        `导入完成：成功 ${data.successCount} 条，失败 ${data.failureCount} 条`
      );
    });
  }

  return (
    <div className="page-shell">
      <div className="container">
        <section className="page-hero panel">
          <span className="eyebrow">运营后台</span>
          <h1 className="page-title">资源管理与需求洞察</h1>
          <p className="page-copy">
            这里不是简单的增删改，而是把搜索词、点击和下载行为都转成可用的内容决策。
          </p>
        </section>

        <div className="metrics-grid">
          {metrics.map((metric) => (
            <div className="metric-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>

        <div className="admin-layout section">
          <div className="admin-grid">
            <section className="admin-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">资源列表</h2>
                  <p className="section-subtitle">支持编辑、删除和状态维护。</p>
                </div>
              </div>

              <div className="admin-table">
                {sortedResources.map((resource) => (
                  <div className="admin-row" key={resource.id}>
                    <div>
                      <div className="meta-row">
                        <span className="meta-pill">{resource.category}</span>
                        <span className="meta-pill">{resource.publish_status}</span>
                      </div>
                      <h3>{resource.title}</h3>
                      <p className="muted">{resource.summary}</p>
                    </div>
                    <div className="action-row">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleEdit(resource)}
                      >
                        编辑
                      </button>
                      <button
                        className="button button-warning"
                        type="button"
                        onClick={() => handleDelete(resource.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">搜索洞察</h2>
                  <p className="section-subtitle">优先补无结果词和高频需求词。</p>
                </div>
              </div>

              <div className="metrics-grid">
                <div className="feedback-card admin-card">
                  <h3>高频搜索词</h3>
                  <div className="admin-table">
                    {topQueries.length > 0 ? (
                      topQueries.map((item) => (
                        <div className="info-item" key={item.query}>
                          <span>{item.query}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted">还没有搜索数据。</p>
                    )}
                  </div>
                </div>

                <div className="feedback-card admin-card">
                  <h3>无结果搜索词</h3>
                  <div className="admin-table">
                    {noResultQueries.length > 0 ? (
                      noResultQueries.map((item) => (
                        <div className="info-item" key={item.query}>
                          <span>{item.query}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted">暂无无结果搜索词。</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">新增或编辑资源</h2>
                  <p className="section-subtitle">更新后搜索页和详情页会立即使用新数据。</p>
                </div>
              </div>

              <form className="admin-form" onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="title">标题</label>
                  <input id="title" name="title" value={form.title} onChange={handleInputChange} required />
                </div>

                <div className="field">
                  <label htmlFor="slug">Slug</label>
                  <input id="slug" name="slug" value={form.slug} onChange={handleInputChange} required />
                </div>

                <div className="field">
                  <label htmlFor="summary">摘要</label>
                  <textarea
                    id="summary"
                    name="summary"
                    value={form.summary}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="category">分类</label>
                  <input
                    id="category"
                    name="category"
                    value={form.category}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="tags">标签</label>
                  <input id="tags" name="tags" value={form.tags} onChange={handleInputChange} />
                </div>

                <div className="field">
                  <label htmlFor="cover">封面图</label>
                  <input id="cover" name="cover" value={form.cover} onChange={handleInputChange} required />
                </div>

                <div className="field">
                  <label htmlFor="quark_url">夸克链接</label>
                  <input
                    id="quark_url"
                    name="quark_url"
                    value={form.quark_url}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="extract_code">提取码</label>
                  <input
                    id="extract_code"
                    name="extract_code"
                    value={form.extract_code}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="field">
                  <label htmlFor="publish_status">状态</label>
                  <select
                    id="publish_status"
                    name="publish_status"
                    value={form.publish_status}
                    onChange={handleInputChange}
                  >
                    <option value="draft">草稿</option>
                    <option value="published">已发布</option>
                    <option value="offline">已下线</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="published_at">发布时间</label>
                  <input
                    id="published_at"
                    name="published_at"
                    type="datetime-local"
                    value={form.published_at}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="action-row">
                  <button className="button button-primary" disabled={isPending} type="submit">
                    {isPending ? "保存中..." : form.id ? "更新资源" : "新增资源"}
                  </button>
                  <button className="button button-secondary" type="button" onClick={resetForm}>
                    清空表单
                  </button>
                </div>
              </form>
            </section>

            <section className="admin-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">CSV 导入</h2>
                  <p className="section-subtitle">支持批量导入或覆盖更新资源。</p>
                </div>
              </div>

              <div className="field">
                <label htmlFor="csv-file">上传 CSV</label>
                <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
              </div>

              <div className="field">
                <label htmlFor="csv">CSV 内容</label>
                <textarea id="csv" value={csv} onChange={(event) => setCsv(event.target.value)} />
              </div>

              <div className="action-row">
                <button className="button button-primary" type="button" onClick={handleImport}>
                  执行导入
                </button>
              </div>
            </section>

            {message ? (
              <section className="admin-card">
                <strong>操作结果</strong>
                <p className="muted">{message}</p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
