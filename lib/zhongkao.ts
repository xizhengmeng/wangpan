import type { Resource } from "@/lib/types";
import { GAOKAO_REGION_ORDER } from "@/lib/gaokao";

export const ZHONGKAO_REGION_ORDER = GAOKAO_REGION_ORDER;
export const ZHONGKAO_REGION_SET = new Set<string>(ZHONGKAO_REGION_ORDER);
const REGION_INDEX = new Map<string, number>(ZHONGKAO_REGION_ORDER.map((region, index) => [region, index]));

export function sortZhongkaoRegions(regions: string[]) {
  return Array.from(new Set(regions))
    .filter((region) => ZHONGKAO_REGION_SET.has(region))
    .sort((a, b) => {
      const aIndex = REGION_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = REGION_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.localeCompare(b, "zh-CN");
    });
}

export function getZhongkaoMetaString(resource: Resource, key: string) {
  const value = resource.meta?.[key];
  return typeof value === "string" && value ? value : null;
}

export function getZhongkaoApplicableRegions(resource: Resource) {
  const value = resource.meta?.applicable_regions;
  if (Array.isArray(value)) {
    return sortZhongkaoRegions(value.filter((item): item is string => typeof item === "string"));
  }

  const region = getZhongkaoMetaString(resource, "region");
  return region ? sortZhongkaoRegions([region]) : [];
}

export function getZhongkaoYear(resource: Resource) {
  return getZhongkaoMetaString(resource, "year");
}

export function getZhongkaoSubject(resource: Resource) {
  return getZhongkaoMetaString(resource, "subject");
}

export function getZhongkaoCity(resource: Resource) {
  return getZhongkaoMetaString(resource, "city");
}
