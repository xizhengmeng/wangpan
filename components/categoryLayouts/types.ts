import { Resource, TopicNode } from "@/lib/types";

export interface CategoryLayoutProps {
  categoryName: string;
  channelSlug: string;
  channelName: string;
  slug: string;
  items: Resource[];
  topics: Array<TopicNode & { resources: Resource[] }>;
}
