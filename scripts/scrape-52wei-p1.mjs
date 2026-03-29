/**
 * 抓取 pan.52wei.cc/categories.php?id=5 第一页的资料标题和网盘链接
 * 运行: node scripts/scrape-52wei-p1.mjs
 */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const URL = "https://pan.52wei.cc/categories.php?id=5";
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "../data/scraped-52wei-p1.json");

async function main() {
  console.log("正在抓取:", URL);

  const res = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  console.log("页面大小:", (html.length / 1024).toFixed(1), "KB");

  // 匹配每一条资源：<h3>...<a href="网盘链接">查看详情</a>...标题文字...</h3>
  // 实际结构：<h3><a href="...">标题</a></h3> 和 <a href="https://pan.quark.cn/...">查看详情</a>
  const items = [];

  // 提取资源块：每个 <li> 或资源条目包含标题和"查看详情"链接
  // 用两步：先找标题h3，再找同块内的查看详情链接
  // 结构：<h3>\n  <a ...>标题</a>\n</h3>  ... <a href="https://pan...">查看详情</a>
  
  // 匹配包含「查看详情」的资源段落 —— 取其前面最近的 h3 文字和该链接
  const blockRe = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]{0,600}?href="(https?:\/\/pan\.[^"]+)"[^>]*>\s*查看详情/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    // 清理 h3 内的 HTML 标签，保留文字
    const title = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const link = m[2];
    if (title && link) {
      items.push({ title, link });
    }
  }

  if (items.length === 0) {
    // 备用方案：分别找全部 h3 标题和「查看详情」链接，过滤噪音后对齐 zip
    console.warn("主正则未匹配，尝试备用方案...");

    const NOISE_TITLES = new Set(["批量发布结果", "批量发布", "搜索资源", "深入探索"]);

    const titleRe = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
    const rawTitles = [];
    let tm;
    while ((tm = titleRe.exec(html)) !== null) {
      const t = tm[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (t && t.length >= 5 && !NOISE_TITLES.has(t)) rawTitles.push(t);
    }

    const linkRe = /href="(https?:\/\/pan\.[^"]+)"[^>]*>\s*查看详情/g;
    const links = [];
    let lm;
    while ((lm = linkRe.exec(html)) !== null) {
      links.push(lm[1]);
    }

    const len = Math.min(rawTitles.length, links.length);
    for (let i = 0; i < len; i++) {
      items.push({ title: rawTitles[i], link: links[i] });
    }
  }

  console.log(`共解析到 ${items.length} 条资源`);

  const output = {
    source: URL,
    scraped_at: new Date().toISOString(),
    total: items.length,
    items,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf-8");
  console.log("已保存至:", OUTPUT);

  // 预览前5条
  console.log("\n前5条预览:");
  items.slice(0, 5).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.title}`);
    console.log(`     ${item.link}`);
  });
}

main().catch((err) => {
  console.error("抓取失败:", err.message);
  process.exit(1);
});
