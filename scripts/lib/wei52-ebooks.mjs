import { createHash } from "node:crypto";

export const EBOOK_CHANNEL = {
  id: "channel_ebook_library",
  slug: "ebook-library",
  name: "电子书库",
  description: "收录来自夸克网盘的电子书、套装书、报告文档与长期阅读资源。",
  sort_order: 35,
};

export const EBOOK_CATEGORIES = [
  {
    id: "cat_ebook_novel",
    slug: "novel-literature",
    name: "小说文学",
    description: "小说、文学作品、名著套装与长篇阅读资源。",
    topic: {
      id: "topic_ebook_novel",
      slug: "novel-zone",
      name: "小说文学",
      summary: "收录夸克网盘里的小说、文学与名著资源。",
    },
    cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cat_ebook_history",
    slug: "history-humanities",
    name: "历史人文",
    description: "历史、传记、思想、人文社科与文明专题读物。",
    topic: {
      id: "topic_ebook_history",
      slug: "history-humanities-zone",
      name: "历史人文",
      summary: "收录历史、人物、文明与人文社科相关电子书。",
    },
    cover: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cat_ebook_business",
    slug: "business-management",
    name: "经管职场",
    description: "商业、管理、营销、理财、创业与职场成长读物。",
    topic: {
      id: "topic_ebook_business",
      slug: "business-management-zone",
      name: "经管职场",
      summary: "收录商业管理、职场成长、运营营销和理财书籍。",
    },
    cover: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cat_ebook_tech",
    slug: "tech-ai-books",
    name: "科技AI",
    description: "编程、软件工程、人工智能、数据分析与技术成长读物。",
    topic: {
      id: "topic_ebook_tech",
      slug: "tech-ai-books-zone",
      name: "科技AI",
      summary: "收录编程开发、AI、算法与工程技术相关电子书。",
    },
    cover: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cat_ebook_education",
    slug: "education-language-books",
    name: "教育语言",
    description: "语言学习、育儿教育、心理成长与学习相关书籍。",
    topic: {
      id: "topic_ebook_education",
      slug: "education-language-zone",
      name: "教育语言",
      summary: "收录英语学习、教育心理、育儿和成长读物。",
    },
    cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "cat_ebook_reports",
    slug: "reports-docs",
    name: "报告文档",
    description: "行业报告、白皮书、研究资料与长文档 PDF。",
    topic: {
      id: "topic_ebook_reports",
      slug: "reports-docs-zone",
      name: "报告文档",
      summary: "收录行业研究、报告白皮书与专业长文档资源。",
    },
    cover: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
  },
];

const GLOBAL_INCLUDE = /(电子书|书籍|套装|全集|出版社|豆瓣|epub|mobi|azw3|小说合集|PDF|pdf|全格式)/i;
const GLOBAL_EXCLUDE =
  /(电影|剧集|短剧|动漫|番剧|纪录片|综艺|试卷|题库|手抄报|教案|素材|模板|音频|配套素材|小学|初中|高中|年级|英语启蒙|作文专项|合集推荐)/i;

const HISTORY_RULE = /历史|传记|文明|王朝|中国史|世界史|社会学|哲学|思想|政治学|人类学|社会科学|人物|民国|学术名著|政法|社科|法学/i;
const BUSINESS_RULE = /商业|管理|营销|运营|品牌|销售|职场|创业|投资|财富|经济|时间管理|理财|企业|薪酬/i;
const NOVEL_RULE = /小说|文学|诗集|散文|推理|悬疑|科幻|言情|武侠|四大名著|名著|文集|琼瑶|读客/i;
const EDUCATION_RULE = /英语|日语|韩语|词汇|雅思|托福|四六级|考研英语|语言学习|育儿|早教|亲子|教育|心理学/i;
const TECH_RULE =
  /Python|Java|C\+\+|C语言|JavaScript|JS|TypeScript|Go语言|Rust|编程|程序设计|算法|软件工程|人工智能|AI|机器学习|深度学习|神经网络|大模型|数据分析|数据结构|架构师|图灵|运维|数据中心|计算机|前端|后端|开发|数据库|SQL|Linux|Web3|知识图谱|Pytorch|PyTorch|Selenium|Django/i;
const TECH_BOOK_SIGNAL =
  /(电子书|书籍|套装|全集|epub|mobi|azw3|pdf|PDF|图灵|丛书|系列|合辑|合集|全格式|出版社|原书|第\d+版|Z-Library|异步图书|人民邮电|电子工业出版社|《.+》)/i;
const TECH_BOOK_FALLBACK =
  /(导论|精解|指南|入门|入门到实践|入门到精通|三剑客|高手进阶|核心知识|精粹|从基础到实践|原理与实现|原理|实践指南|手册)/i;
const TECH_EXCLUDE =
  /(课程|教程|训练营|课件|源码|实战课|视频课|带源码课件|MP4|mp4|安装包|插件|破解版|绿色版|客户端|少儿编程|自动化办公|AI绘画神器|工具盘点|搜索神器|白嫖|阅读器|资料包|涨粉变现|办公篇|全栈开发线下班|会员|训练班|学习课|短视频|讲义|apk|学城|学院|路飞|imooc|慕课|尚硅谷|牛客网|超星尔雅|极客时间|B站|知识星球|大学.*课程|课堂|实战班|刷题|面试专题|架构师.*期|在线教育类app|商业实战班|后端高级工程师|马士兵|深度之眼|全栈实战)/i;
const REPORT_RULE =
  /(研究报告|调查报告|行业报告|趋势报告|白皮书|蓝皮书|报告合集|洞察报告|发展报告|年度报告|分析报告|专题报告|贸易趋势报告|满意度调查报告|消费报告|招股书|招募说明书|年鉴)/i;
const REPORT_SIGNAL = /(PDF|pdf|报告|白皮书|蓝皮书|年鉴|研究|洞察|招股书|说明书)/i;
const REPORT_EXCLUDE =
  /(报告单|诊断报告|化验单|病理|病历|小说|文学|课程|教程|训练营|视频课|资料包|合集推荐|高考蓝皮书|高中|中考|高考|发现报告|付费课|完结|B站|行业报告\s*[\d.]+|亲子白皮书|学习白皮书|中学.*白皮书|落地实操|王骁Albert)/i;
const REPORT_YEARBOOK_RULE = /(统计年鉴|考古学年鉴|教育年鉴|经济年鉴|发展年鉴|中国.*年鉴|世界.*年鉴)/i;

export function stableId(prefix, input) {
  return `${prefix}_${createHash("sha1").update(String(input)).digest("hex").slice(0, 16)}`;
}

export function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

export function cleanEbookTitle(input) {
  return normalizeText(
    String(input || "")
      .replace(/夸克网盘\/百度网盘下载/gi, "")
      .replace(/夸克网盘下载/gi, "")
      .replace(/百度网盘下载/gi, "")
      .replace(/[?？]{2,}/g, "")
      .replace(/\|+$/g, "")
      .replace(/\s*【公众号：[^】]+】/g, "")
      .replace(/\s*\(1\)\s*$/g, "")
  );
}

export function inferEbookCategory(title) {
  const clean = cleanEbookTitle(title);
  if (GLOBAL_EXCLUDE.test(clean)) {
    return null;
  }

  if (REPORT_EXCLUDE.test(clean)) {
    // continue to other categories; no early return
  } else if (
    ((REPORT_RULE.test(clean) && REPORT_SIGNAL.test(clean)) ||
      (REPORT_YEARBOOK_RULE.test(clean) && /(PDF|pdf|合集|年鉴)/i.test(clean)))
  ) {
    return "reports_docs";
  }

  if (
    !TECH_EXCLUDE.test(clean) &&
    TECH_RULE.test(clean) &&
    (TECH_BOOK_SIGNAL.test(clean) || (GLOBAL_INCLUDE.test(clean) && TECH_BOOK_FALLBACK.test(clean)))
  ) {
    return "tech_ai";
  }

  if (HISTORY_RULE.test(clean) && GLOBAL_INCLUDE.test(clean)) {
    return "history_humanities";
  }

  if (BUSINESS_RULE.test(clean) && GLOBAL_INCLUDE.test(clean)) {
    return "business_management";
  }

  if (NOVEL_RULE.test(clean) && GLOBAL_INCLUDE.test(clean)) {
    return "novel_literature";
  }

  if (EDUCATION_RULE.test(clean) && GLOBAL_INCLUDE.test(clean)) {
    return "education_language";
  }

  return null;
}

export function getCategoryConfig(categoryKey) {
  switch (categoryKey) {
    case "novel_literature":
      return EBOOK_CATEGORIES[0];
    case "history_humanities":
      return EBOOK_CATEGORIES[1];
    case "business_management":
      return EBOOK_CATEGORIES[2];
    case "tech_ai":
      return EBOOK_CATEGORIES[3];
    case "education_language":
      return EBOOK_CATEGORIES[4];
    case "reports_docs":
      return EBOOK_CATEGORIES[5];
    default:
      return null;
  }
}

export function buildEbookSummary(title, categoryName) {
  const clean = cleanEbookTitle(title)
    .replace(/[《》]/g, "")
    .replace(/[【】\[\]]/g, "")
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/[丨|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const label = clean || title;
  return `${label}已整理到${categoryName}栏目，适合通过夸克网盘统一转存后阅读、检索和长期收藏。`;
}

export function inferEbookTags(title, categoryName, topicName) {
  const tags = new Map();
  const push = (value) => {
    const name = normalizeText(value);
    if (!name) return;
    const slug = slugify(name);
    if (!slug || tags.has(slug)) return;
    tags.set(slug, name);
  };

  push("52wei");
  push("电子书");
  push(categoryName);
  push(topicName);

  if (/PDF|pdf/.test(title)) push("PDF");
  if (/epub/i.test(title)) push("EPUB");
  if (/mobi/i.test(title)) push("MOBI");
  if (/azw3/i.test(title)) push("AZW3");
  if (/套装|全集/.test(title)) push("套装");
  if (/豆瓣/.test(title)) push("豆瓣推荐");
  if (/出版社/.test(title)) push("出版社");

  return Array.from(tags.entries()).map(([tag_slug, tag_name], sort_order) => ({
    tag_name,
    tag_slug,
    sort_order,
  }));
}
