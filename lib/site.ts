export const siteConfig = {
  name: "夸克资料搜索站",
  shortName: "夸克资料站",
  description:
    "查找考试资料、模板素材、办公技能和编程资源，快速直达夸克网盘下载。",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.baseUrl).toString();
}
