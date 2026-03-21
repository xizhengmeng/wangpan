export const siteConfig = {
  name: "夸克资料搜索站",
  shortName: "夸克网盘资料",
  description:
    "夸克网盘资料搜索站，收录海量夸克网盘资料，涵盖考试试卷、课程素材、办公模板与编程资源。免费搜索夸克网盘资料，快速定位并直达下载。",
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.baseUrl).toString();
}
