import DefaultTopicLayout from "./DefaultTopicLayout";
import GaokaoZhentiLayout from "./GaokaoZhentiLayout";
import MiddleSchoolZoneLayout from "./MiddleSchoolZoneLayout";
import ZhongkaoZhentiLayout from "./ZhongkaoZhentiLayout";
import PrimarySchoolZoneLayout from "./PrimarySchoolZoneLayout";
import HighSchoolZoneLayout from "./HighSchoolZoneLayout";
import EbookTopicLayout from "./EbookTopicLayout";
import type { TopicLayoutProps } from "./types";

export type TopicLayoutComponent = (props: TopicLayoutProps) => JSX.Element;

/**
 * 在这里注册需要定制布局的专题 slug。
 * 未注册的专题自动使用 DefaultTopicLayout。
 */
const registry: Partial<Record<string, TopicLayoutComponent>> = {
  gaokaozhenti: GaokaoZhentiLayout,
  "middle-school-zone": MiddleSchoolZoneLayout,
  "primary-school-zone": PrimarySchoolZoneLayout,
  "high-school-zone": HighSchoolZoneLayout,
  zhongkaozhenti: ZhongkaoZhentiLayout,
  "novel-zone": EbookTopicLayout,
  "history-humanities-zone": EbookTopicLayout,
  "business-management-zone": EbookTopicLayout,
  "tech-ai-books-zone": EbookTopicLayout,
  "education-language-zone": EbookTopicLayout,
  "reports-docs-zone": EbookTopicLayout,
};

export function getTopicLayout(slug: string): TopicLayoutComponent {
  return registry[slug] ?? DefaultTopicLayout;
}

export { DefaultTopicLayout };
export type { TopicLayoutProps };
