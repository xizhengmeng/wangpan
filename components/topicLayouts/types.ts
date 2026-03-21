import { Resource } from "@/lib/types";

export interface TopicLayoutProps {
  topic: {
    id: string;
    name: string;
    slug: string;
    summary: string;
  };
  categoryName: string;
  categorySlug: string;
  channelName: string;
  channelSlug: string;
  resources: Resource[];
}
