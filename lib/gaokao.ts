import type { Resource } from "@/lib/types";

export const GAOKAO_REGION_ORDER = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江", "江苏", "浙江", "安徽",
  "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "海南", "四川", "贵州", "云南", "陕西",
  "甘肃", "青海", "内蒙古", "广西", "西藏", "宁夏", "新疆",
] as const;

export const GAOKAO_REGION_SET = new Set<string>(GAOKAO_REGION_ORDER);
const REGION_INDEX = new Map<string, number>(GAOKAO_REGION_ORDER.map((region, index) => [region, index]));

export function sortGaokaoRegions(regions: string[]) {
  return Array.from(new Set(regions))
    .filter((region) => GAOKAO_REGION_SET.has(region))
    .sort((a, b) => {
      const aIndex = REGION_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = REGION_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.localeCompare(b, "zh-CN");
    });
}

export function getGaokaoMetaString(resource: Resource, key: string) {
  const value = resource.meta?.[key];
  return typeof value === "string" && value ? value : null;
}

export function getGaokaoApplicableRegions(resource: Resource) {
  const value = resource.meta?.applicable_regions;
  if (Array.isArray(value)) {
    return sortGaokaoRegions(value.filter((item): item is string => typeof item === "string"));
  }

  const region = getGaokaoMetaString(resource, "region");
  return region ? sortGaokaoRegions([region]) : [];
}

export function getGaokaoYear(resource: Resource) {
  return getGaokaoMetaString(resource, "year");
}

export function getGaokaoSubject(resource: Resource) {
  return getGaokaoMetaString(resource, "subject");
}
