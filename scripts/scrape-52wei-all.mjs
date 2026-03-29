/**
 * 批量抓取 pan.52wei.cc/categories.php?id=5 所有页数据
 * - 每 100 条存一个 JSON 文件到 data/scraped-52wei/batch-XXXX.json
 * - 支持断点续爬：读取进度文件，自动从中断位置恢复
 * - 限速：每次请求间隔 800ms，出错后指数退避重试最多 4 次
 *
 * 运行: node scripts/scrape-52wei-all.mjs
 * 停止: Ctrl+C（进度自动保存，下次运行自动续跑）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── 配置 ────────────────────────────────────────────────────────────────────
const BASE_URL   = "https://pan.52wei.cc/categories.php?id=5";
const TOTAL_PAGES = 5040;
const ITEMS_PER_FILE = 100;
const DELAY_MS   = 800;   // 正常间隔
const RETRY_MAX  = 4;
const __dir      = dirname(fileURLToPath(import.meta.url));
const OUT_DIR    = join(__dir, "../data/scraped-52wei");
const PROGRESS_FILE = join(OUT_DIR, "_progress.json");

// ── 工具函数 ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toTimeString().slice(0, 8);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

// 从 HTML 中解析标题和链接
const NOISE_TITLES = new Set(["批量发布结果", "批量发布", "搜索资源", "深入探索"]);

function parseItems(html) {
  const items = [];

  // 主方案：h3 块 + 同块内查看详情链接
  const blockRe = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]{0,600}?href="(https?:\/\/pan\.[^"]+)"[^>]*>\s*查看详情/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const title = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (title && title.length >= 5 && !NOISE_TITLES.has(title)) {
      items.push({ title, link: m[2] });
    }
  }

  if (items.length > 0) return items;

  // 备用方案：分别收集 h3 与查看详情链接后 zip
  const titleRe = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
  const titles = [];
  let tm;
  while ((tm = titleRe.exec(html)) !== null) {
    const t = tm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t && t.length >= 5 && !NOISE_TITLES.has(t)) titles.push(t);
  }

  const linkRe = /href="(https?:\/\/pan\.[^"]+)"[^>]*>\s*查看详情/g;
  const links = [];
  let lm;
  while ((lm = linkRe.exec(html)) !== null) links.push(lm[1]);

  const len = Math.min(titles.length, links.length);
  for (let i = 0; i < len; i++) items.push({ title: titles[i], link: links[i] });
  return items;
}

// 带重试的 fetch
async function fetchPage(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}&page=${page}`;
  let delay = 1500;
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "Referer": BASE_URL,
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === RETRY_MAX) throw err;
      log(`  ⚠ 第 ${page} 页第 ${attempt} 次失败 (${err.message})，${delay / 1000}s 后重试`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

// 进度读写
function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { nextPage: 1, buffer: [], fileIndex: 1 };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return { nextPage: 1, buffer: [], fileIndex: 1 };
  }
}

function saveProgress(state) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// 将 buffer 写入批次文件
function flushBuffer(buffer, fileIndex) {
  const filename = `batch-${String(fileIndex).padStart(4, "0")}.json`;
  const filepath = join(OUT_DIR, filename);
  writeFileSync(
    filepath,
    JSON.stringify({
      source: BASE_URL,
      file_index: fileIndex,
      total: buffer.length,
      items: buffer,
    }, null, 2),
    "utf-8"
  );
  log(`  💾 已写入 ${filename}（${buffer.length} 条）`);
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const state = loadProgress();
  let { nextPage, buffer, fileIndex } = state;

  if (nextPage > 1) {
    log(`🔄 断点续爬，从第 ${nextPage} 页开始（已有 ${buffer.length} 条缓冲，当前批次文件 #${fileIndex}）`);
  } else {
    log(`🚀 开始抓取，共 ${TOTAL_PAGES} 页`);
  }

  // Ctrl+C 时保存进度
  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
    log("\n🛑 收到中断信号，正在保存进度...");
    saveProgress({ nextPage, buffer, fileIndex });
    log(`✅ 进度已保存（下次运行从第 ${nextPage} 页继续）`);
    process.exit(0);
  });

  const startTime = Date.now();

  for (let page = nextPage; page <= TOTAL_PAGES; page++) {
    if (interrupted) break;

    try {
      const html = await fetchPage(page);
      const items = parseItems(html);

      if (items.length === 0) {
        // 可能已到末尾
        log(`  ⚠ 第 ${page} 页解析到 0 条，跳过`);
      } else {
        buffer.push(...items);
      }

      // 每 100 条存一个文件
      while (buffer.length >= ITEMS_PER_FILE) {
        flushBuffer(buffer.splice(0, ITEMS_PER_FILE), fileIndex);
        fileIndex++;
      }

      // 每 10 页记录一次进度
      if (page % 10 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const pct = ((page / TOTAL_PAGES) * 100).toFixed(1);
        const eta = Math.round(((TOTAL_PAGES - page) * DELAY_MS) / 1000 / 60);
        log(`  📊 进度 ${page}/${TOTAL_PAGES} (${pct}%) | 缓冲 ${buffer.length} 条 | 已用 ${elapsed}s | 预计剩余 ${eta}min`);
        saveProgress({ nextPage: page + 1, buffer, fileIndex });
      }

    } catch (err) {
      log(`  ✗ 第 ${page} 页抓取最终失败: ${err.message}，跳过`);
    }

    nextPage = page + 1;

    // 限速
    if (page < TOTAL_PAGES) await sleep(DELAY_MS);
  }

  // 写入剩余 buffer
  if (buffer.length > 0) {
    flushBuffer(buffer, fileIndex);
    fileIndex++;
  }

  // 清除进度文件（完成）
  if (!interrupted && nextPage > TOTAL_PAGES) {
    writeFileSync(PROGRESS_FILE, JSON.stringify({ done: true, completedAt: new Date().toISOString() }, null, 2));
    const total = (fileIndex - 1) * ITEMS_PER_FILE + buffer.length;
    log(`\n🎉 全部完成！共 ${fileIndex - 1} 个批次文件，数据保存在 data/scraped-52wei/`);
  }
}

main().catch((err) => {
  console.error("脚本异常:", err);
  process.exit(1);
});
