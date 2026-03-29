/**
 * 单分类抓取器 — 用法：
 *   node scripts/scrape-cat.mjs --id 2
 *   node scripts/scrape-cat.mjs --id 3
 *   node scripts/scrape-cat.mjs --id 4
 *
 * 支持断点续爬，数据输出到 data/scraped-52wei/cat{id}/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── CLI 参数 ──────────────────────────────────────────────────────────────────
const idArg = process.argv.indexOf("--id");
if (idArg === -1 || !process.argv[idArg + 1]) {
  console.error("用法: node scripts/scrape-cat.mjs --id <分类ID>");
  process.exit(1);
}
const CAT_ID = parseInt(process.argv[idArg + 1], 10);

const CATEGORY_MAP = {
  2: { name: "短剧",  totalPages: 2631 },
  3: { name: "电子书", totalPages: 760  },
  4: { name: "软件",  totalPages: 1235 },
  5: { name: "资料",  totalPages: 5040 },
};

const cat = CATEGORY_MAP[CAT_ID];
if (!cat) {
  console.error(`未知分类 id=${CAT_ID}，支持: ${Object.keys(CATEGORY_MAP).join(", ")}`);
  process.exit(1);
}

// ── 配置 ──────────────────────────────────────────────────────────────────────
const BASE           = "https://pan.52wei.cc/categories.php";
const DELAY_MS       = 800;
const RETRY_MAX      = 4;
const ITEMS_PER_FILE = 100;

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dir, "../data/scraped-52wei");
const OUT_DIR  = join(ROOT_DIR, `cat${CAT_ID}`);
const PROGRESS_FILE = join(OUT_DIR, "_progress.json");

// ── 工具 ──────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log   = (msg) => process.stdout.write(`[${new Date().toTimeString().slice(0, 8)}] ${msg}\n`);

const NOISE_TITLES = new Set(["批量发布结果", "批量发布", "搜索资源", "深入探索"]);

function parseItems(html) {
  const items = [];
  const blockRe = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]{0,600}?href="(https?:\/\/pan\.[^"]+)"[^>]*>\s*查看详情/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const title = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (title && title.length >= 5 && !NOISE_TITLES.has(title)) items.push({ title, link: m[2] });
  }
  if (items.length > 0) return items;

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

async function fetchPage(page) {
  const url = page === 1 ? `${BASE}?id=${CAT_ID}` : `${BASE}?id=${CAT_ID}&page=${page}`;
  let delay = 1500;
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "Referer": `${BASE}?id=${CAT_ID}`,
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === RETRY_MAX) throw err;
      log(`  ⚠ [${cat.name}] 第${page}页 第${attempt}次失败(${err.message})，${delay/1000}s后重试`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { nextPage: 1, buffer: [], fileIndex: 1 };
  try { return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")); }
  catch { return { nextPage: 1, buffer: [], fileIndex: 1 }; }
}

function saveProgress(state) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function flushBuffer(buffer, fileIndex) {
  const fname = `batch-${String(fileIndex).padStart(4, "0")}.json`;
  writeFileSync(
    join(OUT_DIR, fname),
    JSON.stringify({ source: `${BASE}?id=${CAT_ID}`, category: cat.name, file_index: fileIndex, total: buffer.length, items: buffer }, null, 2),
    "utf-8"
  );
  log(`  💾 [${cat.name}] ${fname}（${buffer.length} 条）`);
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let { nextPage, buffer, fileIndex } = loadProgress();

  if (nextPage > cat.totalPages) {
    log(`✅ [${cat.name}] 已全部完成`);
    return;
  }
  if (nextPage > 1) {
    log(`🔄 [${cat.name}] 断点续爬，从第 ${nextPage}/${cat.totalPages} 页`);
  } else {
    log(`🚀 [${cat.name}] 开始抓取，共 ${cat.totalPages} 页`);
  }

  const interrupted = { value: false };
  process.on("SIGINT", () => {
    interrupted.value = true;
    log(`\n🛑 [${cat.name}] 收到中断，完成当前页后保存进度...`);
  });

  const startTime = Date.now();

  for (let page = nextPage; page <= cat.totalPages; page++) {
    if (interrupted.value) {
      saveProgress({ nextPage: page, buffer, fileIndex });
      log(`⏸ [${cat.name}] 进度已保存（第 ${page} 页）`);
      return;
    }

    try {
      const html = await fetchPage(page);
      const items = parseItems(html);
      if (items.length > 0) buffer.push(...items);
      else log(`  ⚠ [${cat.name}] 第${page}页 0条，跳过`);

      while (buffer.length >= ITEMS_PER_FILE) {
        flushBuffer(buffer.splice(0, ITEMS_PER_FILE), fileIndex++);
      }

      if (page % 10 === 0) {
        const pct = ((page / cat.totalPages) * 100).toFixed(1);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const eta     = Math.round(((cat.totalPages - page) * DELAY_MS) / 60000);
        log(`  📊 [${cat.name}] ${page}/${cat.totalPages}(${pct}%) | 缓冲${buffer.length} | 已用${elapsed}s | 剩余≈${eta}min`);
        saveProgress({ nextPage: page + 1, buffer, fileIndex });
      }
    } catch (err) {
      log(`  ✗ [${cat.name}] 第${page}页失败: ${err.message}，跳过`);
    }

    if (page < cat.totalPages) await sleep(DELAY_MS);
  }

  if (buffer.length > 0) flushBuffer(buffer, fileIndex++);
  writeFileSync(PROGRESS_FILE, JSON.stringify({ done: true, completedAt: new Date().toISOString() }, null, 2));
  log(`🎉 [${cat.name}] 全部完成！数据在 ${OUT_DIR}`);
}

main().catch((err) => { console.error("脚本异常:", err); process.exit(1); });
