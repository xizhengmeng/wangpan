import { Resource, TopicNode } from "@/lib/types";

export interface CategoryLayoutProps {
  categoryName: string;
  channelSlug: string;
  channelName: string;
  slug: string;
  items: Resource[];
  page: number;
  total: number;
  totalPages: number;
  topics: Array<TopicNode & { resources: Resource[] }>;
}
