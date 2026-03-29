const COVER_BY_FAMILY = {
  office: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  design: "https://images.unsplash.com/photo-1516321310764-8d4a5fcdb30b?auto=format&fit=crop&w=1200&q=80",
  video: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80",
  development: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
  utility: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=1200&q=80",
  plugin: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1200&q=80",
  pdf: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80",
  cad: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
  mobile: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
  generic: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
};

const PRODUCT_RULES = [
  { pattern: /Photoshop|PS教程|PS插件|AdobePhotoshop|Adobe Photoshop/i, product: "Adobe Photoshop", family: "design" },
  { pattern: /Premiere|PR教程|AdobePremiere|Premiere Pro/i, product: "Adobe Premiere Pro", family: "video" },
  { pattern: /Final Cut|FCPX/i, product: "Final Cut Pro", family: "video" },
  { pattern: /After Effects|AE插件|\bAE\b/i, product: "Adobe After Effects", family: "video" },
  { pattern: /Illustrator|Adobeillustrator|Adobe Illustrator/i, product: "Adobe Illustrator", family: "design" },
  { pattern: /Acrobat|PDF-XChange|轻闪PDF|PDF/i, product: "PDF 工具", family: "pdf" },
  { pattern: /WPS|Office|Excel|Word|PowerPoint|PPT/i, product: "Office 办公软件", family: "office" },
  { pattern: /AutoCAD|CAD软件|中望CAD|CAD|SketchUP/i, product: "CAD 设计软件", family: "cad" },
  { pattern: /Cursor|IDEA|Python|C\+\+|软件测试|开发/i, product: "开发工具", family: "development" },
  { pattern: /WinRAR|IDM|迅雷|抢票|Cleanmymac|CleanMyMac|RegCool|工具箱|SubtitleEdit|下载工具/i, product: "系统与效率工具", family: "utility" },
  { pattern: /插件|扩展|油猴|预设/i, product: "插件与扩展", family: "plugin" },
  { pattern: /微信|QQ|抖音|TikTok|七猫|pixiv|Duolingo|TV软件|电视软件/i, product: "应用与客户端", family: "mobile" },
];

const EXTRANEOUS_PATTERNS = [
  /夸克网盘\/百度网盘下载/gi,
  /夸克网盘下载/gi,
  /百度网盘下载/gi,
  /\|+$/g,
  /^\?+/g,
  /【\s*Win\s*】/gi,
];

function normalizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function cleanTitle(rawTitle) {
  let value = String(rawTitle || "");
  for (const pattern of EXTRANEOUS_PATTERNS) {
    value = value.replace(pattern, "");
  }
  return normalizeText(value);
}

function stripDecorations(title) {
  return cleanTitle(title)
    .replace(/[《》【】\[\]]/g, "")
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/[丨|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferResourceKind(title) {
  if (/插件|扩展|油猴|预设/.test(title)) return "plugin";
  if (/教程|课程|训练营|系统课|入门|实战|学习|大师课|精品班/.test(title)) return "tutorial";
  if (/合集|全家桶|集合包|套装|模块合集/.test(title)) return "collection";
  if (/绿色版|破解版|便携版|安装版|客户端|最新版|正式版|特别版|免激活|直装/.test(title)) return "package";
  return "generic";
}

function inferSoftwareProfile(title, category = "", tags = []) {
  const source = [title, category, ...(tags || [])].join(" ");
  for (const rule of PRODUCT_RULES) {
    if (rule.pattern.test(source)) {
      return {
        product: rule.product,
        family: rule.family,
        kind: inferResourceKind(source),
      };
    }
  }

  return {
    product: category === "插件与书签" ? "插件与扩展" : "软件工具",
    family: category === "插件与书签" ? "plugin" : "generic",
    kind: inferResourceKind(source),
  };
}

function usageText(family) {
  switch (family) {
    case "office":
      return "文档处理、表格制作和演示汇报";
    case "design":
      return "平面设计、修图和视觉创作";
    case "video":
      return "视频剪辑、特效包装和内容制作";
    case "development":
      return "编程开发、测试和工程实践";
    case "utility":
      return "系统维护、下载管理和效率提升";
    case "plugin":
      return "功能扩展、特效预设和工作流增强";
    case "pdf":
      return "PDF 编辑、转换和文档处理";
    case "cad":
      return "制图建模和工程设计";
    case "mobile":
      return "客户端使用、移动工具和账号效率";
    default:
      return "软件下载、安装与效率提升";
  }
}

function familyLabel(family) {
  switch (family) {
    case "office":
      return "办公软件";
    case "design":
      return "设计软件";
    case "video":
      return "视频软件";
    case "development":
      return "开发工具";
    case "utility":
      return "系统工具";
    case "plugin":
      return "插件资源";
    case "pdf":
      return "PDF 工具";
    case "cad":
      return "CAD 工具";
    case "mobile":
      return "应用客户端";
    default:
      return "软件资源";
  }
}

function kindDescription(kind, product) {
  switch (kind) {
    case "plugin":
      return `这是一组围绕 ${product} 的插件、扩展或预设资源`;
    case "tutorial":
      return `这是一份围绕 ${product} 的教程或实战课程资源`;
    case "collection":
      return `这是一组围绕 ${product} 整理的合集资源`;
    case "package":
      return `这是一份围绕 ${product} 的安装包、绿色版或客户端资源`;
    default:
      return `这是一份围绕 ${product} 整理的软件相关资源`;
  }
}

function buildSoftwareSummary(title, category = "", tags = []) {
  const clean = stripDecorations(title);
  const profile = inferSoftwareProfile(title, category, tags);
  const family = familyLabel(profile.family);
  const usage = usageText(profile.family);
  const subject = clean || profile.product;
  return `${subject}属于${family}内容。${kindDescription(profile.kind, profile.product)}，适合需要${usage}的用户，可通过夸克网盘转存后查看或使用。`;
}

function pickSoftwareCover(title, category = "", tags = []) {
  const profile = inferSoftwareProfile(title, category, tags);
  return COVER_BY_FAMILY[profile.family] || COVER_BY_FAMILY.generic;
}

export {
  buildSoftwareSummary,
  cleanTitle,
  inferSoftwareProfile,
  pickSoftwareCover,
  stripDecorations,
};
