import DefaultTopicLayout from "./DefaultTopicLayout";
import GaokaoZhentiLayout from "./GaokaoZhentiLayout";
import MiddleSchoolZoneLayout from "./MiddleSchoolZoneLayout";
import ZhongkaoZhentiLayout from "./ZhongkaoZhentiLayout";
import type { TopicLayoutProps } from "./types";

export type TopicLayoutComponent = (props: TopicLayoutProps) => JSX.Element;

/**
 * 在这里注册需要定制布局的专题 slug。
 * 未注册的专题自动使用 DefaultTopicLayout。
 */
const registry: Partial<Record<string, TopicLayoutComponent>> = {
  gaokaozhenti: GaokaoZhentiLayout,
  "middle-school-zone": MiddleSchoolZoneLayout,
  zhongkaozhenti: ZhongkaoZhentiLayout,
};

export function getTopicLayout(slug: string): TopicLayoutComponent {
  return registry[slug] ?? DefaultTopicLayout;
}

export { DefaultTopicLayout };
export type { TopicLayoutProps };
