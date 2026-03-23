import type { Resource } from "@/lib/types";
import {
  GAOKAO_REGION_SET,
  getGaokaoApplicableRegions,
  getGaokaoSubject,
  getGaokaoYear,
  sortGaokaoRegions,
} from "@/lib/gaokao";
import {
  getZhongkaoApplicableRegions,
  getZhongkaoSubject,
  getZhongkaoYear,
  sortZhongkaoRegions,
  ZHONGKAO_REGION_SET,
} from "@/lib/zhongkao";

export interface ExamTopicConfig {
  slug: "gaokaozhenti" | "zhongkaozhenti";
  label: string;
  regionSet: Set<string>;
  sortRegions: (regions: string[]) => string[];
  getApplicableRegions: (resource: Resource) => string[];
  getSubject: (resource: Resource) => string | null;
  getYear: (resource: Resource) => string | null;
}

const EXAM_TOPIC_CONFIGS: Record<string, ExamTopicConfig> = {
  gaokaozhenti: {
    slug: "gaokaozhenti",
    label: "高考真题",
    regionSet: GAOKAO_REGION_SET,
    sortRegions: sortGaokaoRegions,
    getApplicableRegions: getGaokaoApplicableRegions,
    getSubject: getGaokaoSubject,
    getYear: getGaokaoYear,
  },
  zhongkaozhenti: {
    slug: "zhongkaozhenti",
    label: "中考真题",
    regionSet: ZHONGKAO_REGION_SET,
    sortRegions: sortZhongkaoRegions,
    getApplicableRegions: getZhongkaoApplicableRegions,
    getSubject: getZhongkaoSubject,
    getYear: getZhongkaoYear,
  },
};

export function getExamTopicConfig(slug: string) {
  return EXAM_TOPIC_CONFIGS[slug] || null;
}
