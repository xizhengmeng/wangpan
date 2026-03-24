import QRCode from "qrcode";
import { useEffect, useId, useMemo, useState } from "react";

interface ResourceDownloadEntryProps {
  resourceId: string;
  initialDownloadUrl: string | null;
}

interface DownloadStatusResponse {
  found: boolean;
  downloadUrl: string | null;
}

const SEARCH_TIMEOUT_MS = 10000;
const SEARCH_POLL_INTERVAL_MS = 2000;

function shouldUseDirectJump() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const compactLayout = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 960px)").matches;

  return /android|iphone|ipad|ipod|mobile|windows phone|harmonyos/.test(ua) || coarsePointer || compactLayout;
}

export function ResourceDownloadEntry({
  resourceId,
  initialDownloadUrl,
}: ResourceDownloadEntryProps) {
  const dialogTitleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedDownloadUrl, setResolvedDownloadUrl] = useState(initialDownloadUrl);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "failed">(
    initialDownloadUrl ? "idle" : "searching",
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  const entryUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URL(`/go/${resourceId}`, window.location.origin).toString();
    }

    return `/go/${resourceId}`;
  }, [resourceId]);

  useEffect(() => {
    setResolvedDownloadUrl(initialDownloadUrl);
    setSearchState(initialDownloadUrl ? "idle" : "searching");
    setQrCodeDataUrl("");
  }, [initialDownloadUrl, resourceId]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || resolvedDownloadUrl) {
      return undefined;
    }

    let cancelled = false;
    let pollTimerId: number | undefined;
    let failureTimerId: number | undefined;
    const deadline = Date.now() + SEARCH_TIMEOUT_MS;

    setSearchState("searching");

    const poll = async () => {
      try {
        const response = await fetch(`/api/resource-download-status?id=${encodeURIComponent(resourceId)}`, {
          cache: "no-store",
        });

        if (!response.ok || cancelled) {
          throw new Error("download lookup failed");
        }

        const data = (await response.json()) as DownloadStatusResponse;

        if (data.found && data.downloadUrl) {
          setResolvedDownloadUrl(data.downloadUrl);
          setSearchState("idle");
          if (failureTimerId) {
            window.clearTimeout(failureTimerId);
          }
          return;
        }
      } catch {
        // Treat lookup failures as a miss and continue polling until timeout.
      }

      if (cancelled) {
        return;
      }

      if (Date.now() >= deadline) {
        setSearchState("failed");
        return;
      }

      pollTimerId = window.setTimeout(poll, SEARCH_POLL_INTERVAL_MS);
    };

    void poll();

    failureTimerId = window.setTimeout(() => {
      if (!cancelled) {
        setSearchState("failed");
      }
    }, SEARCH_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (pollTimerId) {
        window.clearTimeout(pollTimerId);
      }
      if (failureTimerId) {
        window.clearTimeout(failureTimerId);
      }
    };
  }, [isOpen, resolvedDownloadUrl, resourceId]);

  useEffect(() => {
    if (!isOpen || !resolvedDownloadUrl) {
      return undefined;
    }

    if (shouldUseDirectJump()) {
      window.location.assign(`/go/${resourceId}`);
      return undefined;
    }

    let active = true;

    void QRCode.toDataURL(entryUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).then((dataUrl) => {
      if (active) {
        setQrCodeDataUrl(dataUrl);
      }
    }).catch(() => {
      if (active) {
        setQrCodeDataUrl("");
      }
    });

    return () => {
      active = false;
    };
  }, [entryUrl, isOpen, resolvedDownloadUrl, resourceId]);

  const handleOpen = () => {
    if (resolvedDownloadUrl && shouldUseDirectJump()) {
      window.location.assign(`/go/${resourceId}`);
      return;
    }

    setIsOpen(true);
  };

  return (
    <>
      <button className="button-link resource-dl-btn" onClick={handleOpen} type="button">
        进入夸克下载
      </button>

      {isOpen && (
        <div
          aria-labelledby={dialogTitleId}
          aria-modal="true"
          className="download-modal"
          onClick={() => setIsOpen(false)}
          role="dialog"
        >
          <div className="download-modal__backdrop" />
          <div
            className="download-modal__card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="关闭下载弹窗"
              className="download-modal__close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ×
            </button>

            {resolvedDownloadUrl ? (
              <>
                <span className="download-modal__eyebrow">手机扫码下载</span>
                <h3 className="download-modal__title" id={dialogTitleId}>
                  使用手机夸克扫码继续下载
                </h3>
                <p className="download-modal__desc">
                  请打开手机夸克 App 扫描下方二维码。移动端点击下载按钮时会直接跳转，不经过这个弹窗。
                </p>
                <div className="download-modal__qr-shell">
                  {qrCodeDataUrl ? (
                    <img
                      alt="夸克下载二维码"
                      className="download-modal__qr"
                      height={240}
                      src={qrCodeDataUrl}
                      width={240}
                    />
                  ) : (
                    <div className="download-modal__qr-loading">
                      <span className="download-modal__spinner" />
                      <strong>二维码生成中</strong>
                    </div>
                  )}
                </div>
                <p className="download-modal__hint">扫码后会先进入本站下载中转页，再自动跳转夸克网盘。</p>
              </>
            ) : (
              <>
                <span className="download-modal__eyebrow">搜索下载链接</span>
                <h3 className="download-modal__title" id={dialogTitleId}>
                  {searchState === "failed" ? "可用下载链接搜索失败" : "正在搜索可用下载链接"}
                </h3>
                <p className="download-modal__desc">
                  {searchState === "failed"
                    ? "当前没有找到可用的下载入口，请稍后再试。"
                    : "系统正在尝试为这份资料匹配可用下载链接，最多等待 10 秒。"}
                </p>
                <div className="download-modal__status">
                  {searchState === "failed" ? (
                    <span className="download-modal__status-badge download-modal__status-badge--failed">
                      搜索失败
                    </span>
                  ) : (
                    <>
                      <span className="download-modal__spinner" />
                      <span className="download-modal__status-text">搜索中，请稍候…</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
