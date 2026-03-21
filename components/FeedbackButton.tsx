"use client";

import { useState } from "react";

interface FeedbackButtonProps {
  resourceId: string;
}

const REASONS = [
  { value: "expired", label: "链接失效" },
  { value: "wrong_file", label: "文件错误" },
  { value: "extract_error", label: "提取码错误" },
  { value: "other", label: "其他问题" },
];

export function FeedbackButton({ resourceId }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("expired");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit() {
    setStatus("loading");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_id: resourceId, reason, note }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p className="feedback-done">✅ 反馈已提交，感谢告知！</p>;
  }

  return (
    <div className="feedback-wrap">
      {!open ? (
        <button type="button" className="feedback-trigger" onClick={() => setOpen(true)}>
          🚩 链接失效？点此反馈
        </button>
      ) : (
        <div className="feedback-form">
          <p className="feedback-form__title">反馈问题</p>
          <div className="feedback-reasons">
            {REASONS.map((r) => (
              <label key={r.value} className={`feedback-reason${reason === r.value ? " feedback-reason--active" : ""}`}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {r.label}
              </label>
            ))}
          </div>
          <textarea
            className="feedback-note"
            placeholder="补充说明（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <div className="feedback-actions">
            <button
              type="button"
              className="adm-btn adm-btn--primary adm-btn--sm"
              onClick={handleSubmit}
              disabled={status === "loading"}
            >
              {status === "loading" ? "提交中..." : "提交反馈"}
            </button>
            <button type="button" className="adm-btn adm-btn--sm" onClick={() => setOpen(false)}>取消</button>
          </div>
          {status === "error" && <p className="feedback-error">提交失败，请稍后重试</p>}
        </div>
      )}
    </div>
  );
}
