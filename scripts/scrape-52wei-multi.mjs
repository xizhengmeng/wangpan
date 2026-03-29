/**
 * 批量抓取 pan.52wei.cc 多个分类的所有页数据
 * - 每 100 条存一个 JSON：data/scraped-52wei/cat{id}/batch-XXXX.json
 * - 支持断点续爬（进度文件 _progress.json）
 * - 限速 800ms/页，失败指数退避重试最多 4 次
 *
 * 运行: node scripts/scrape-52wei-multi.mjs
 * 停止: Ctrl+C（自动保存进度，下次继续）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── 目标分类配置 ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 2, name: "短剧", totalPages: 2631 },
  { id: 3, name: "电子书", totalPages: 760 },
  { id: 4, name: "软件", totalPages: 1235 },
];

const BASE      = "https://pan.52wei.cc/categories.php";
const DELAY_MS  = 800;
const RETRY_MAX = 4;
const ITEMS_PER_FILE = 100;

const __dir     = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = join(__dir, "../data/scraped-52wei");

// ── 工具 ─────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  process.stdout.write(`[${new Date().toTimeString().slice(0, 8)}] ${msg}\n`);
}

const NOISE_TITLES = new Set(["批量发布结果", "批量发布", "搜索资源", "深入探索"]);

function parseItems(html) {
  const items = [];

  // 主方案：h3 块 + 同块内「查看详情」链接联合匹配
  const blockRe = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]{0,600}?href="(https?:\/\/pan\.[^"]+)"[^>]*>\s*查看详情/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const title = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (title && title.length >= 5 && !NOISE_TITLES.has(title)) {
      items.push({ title, link: m[2] });
    }
  }
  if (items.length > 0) return items;

  // 备用方案：分别收集 h3 标题 + 查看详情链接，过滤噪音后 zip
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

async function fetchPage(id, page) {
  const url = page === 1 ? `${BASE}?id=${id}` : `${BASE}?id=${id}&page=${page}`;
  let delay = 1500;
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "Referer": `${BASE}?id=${id}`,
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === RETRY_MAX) throw err;
      log(`  ⚠ cat${id} 第${page}页 第${attempt}次失败(${err.message})，${delay/1000}s后重试`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

function loadProgress(progressFile) {
  if (!existsSync(progressFile)) return { nextPage: 1, buffer: [], fileIndex: 1 };
  try { return JSON.parse(readFileSync(progressFile, "utf-8")); }
  catch { return { nextPage: 1, buffer: [], fileIndex: 1 }; }
}

function saveProgress(progressFile, state) {
  writeFileSync(progressFile, JSON.stringify(state, null, 2), "utf-8");
}

function flushBuffer(outDir, catId, catName, buffer, fileIndex) {
  const fname = `batch-${String(fileIndex).padStart(4, "0")}.json`;
  writeFileSync(
    join(outDir, fname),
    JSON.stringify({ source: `${BASE}?id=${catId}`, category: catName, file_index: fileIndex, total: buffer.length, items: buffer }, null, 2),
    "utf-8"
  );
  log(`  💾 [${catName}] ${fname}（${buffer.length} 条）`);
}

// ── 爬取单个分类 ──────────────────────────────────────────────────────────────
async function scrapeCategory(cat, interrupted) {
  const outDir = join(ROOT_DIR, `cat${cat.id}`);
  mkdirSync(outDir, { recursive: true });
  const progressFile = join(outDir, "_progress.json");

  let { nextPage, buffer, fileIndex } = loadProgress(progressFile);

  if (nextPage > cat.totalPages) {
    log(`✅ [${cat.name}] 已全部完成，跳过`);
    return;
  }

  if (nextPage > 1) {
    log(`🔄 [${cat.name}] 断点续爬，从第 ${nextPage}/${cat.totalPages} 页`);
  } else {
    log(`🚀 [${cat.name}] 开始抓取，共 ${cat.totalPages} 页`);
  }

  const startTime = Date.now();

  for (let page = nextPage; page <= cat.totalPages; page++) {
    if (interrupted.value) {
      saveProgress(progressFile, { nextPage: page, buffer, fileIndex });
      log(`⏸ [${cat.name}] 进度已保存（第 ${page} 页）`);
      return;
    }

    try {
      const html = await fetchPage(cat.id, page);
      const items = parseItems(html);
      if (items.length > 0) buffer.push(...items);
      else log(`  ⚠ [${cat.name}] 第${page}页 0条，跳过`);

      while (buffer.length >= ITEMS_PER_FILE) {
        flushBuffer(outDir, cat.id, cat.name, buffer.splice(0, ITEMS_PER_FILE), fileIndex++);
      }

      if (page % 10 === 0) {
        const pct = ((page / cat.totalPages) * 100).toFixed(1);
        const eta = Math.round(((cat.totalPages - page) * DELAY_MS) / 60000);
        log(`  📊 [${cat.name}] ${page}/${cat.totalPages}(${pct}%) | 缓冲${buffer.length} | 已用${((Date.now()-startTime)/1000).toFixed(0)}s | 剩余≈${eta}min`);
        saveProgress(progressFile, { nextPage: page + 1, buffer, fileIndex });
      }
    } catch (err) {
      log(`  ✗ [${cat.name}] 第${page}页失败: ${err.message}，跳过`);
    }

    if (page < cat.totalPages) await sleep(DELAY_MS);
  }

  // 写剩余 buffer
  if (buffer.length > 0) flushBuffer(outDir, cat.id, cat.name, buffer, fileIndex++);

  writeFileSync(progressFile, JSON.stringify({ done: true, completedAt: new Date().toISOString() }, null, 2));
  log(`🎉 [${cat.name}] 全部完成！`);
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(ROOT_DIR, { recursive: true });

  const interrupted = { value: false };
  process.on("SIGINT", () => {
    interrupted.value = true;
    log("\n🛑 收到中断信号，完成当前页后保存进度...");
  });

  for (const cat of CATEGORIES) {
    if (interrupted.value) break;
    await scrapeCategory(cat, interrupted);
    if (!interrupted.value && CATEGORIES.indexOf(cat) < CATEGORIES.length - 1) {
      log(`⏭ 切换到下一个分类，等待 2s...`);
      await sleep(2000);
    }
  }

  if (!interrupted.value) {
    log("\n✅ 所有分类抓取完毕！数据在 data/scraped-52wei/cat{id}/ 目录");
  }
}

main().catch((err) => { console.error("脚本异常:", err); process.exit(1); });
