export type PublishStatus = "draft" | "published" | "offline";

export interface TopicFieldSchema {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
}

export type ResourceMetaValue = string | number | boolean | Array<string | number | boolean>;

export interface ResourceItem {
  id: string;
  parent_resource_id: string;
  source_resource_id?: string;
  title: string;
  slug?: string;
  description?: string | null;
  file_type?: string | null;
  file_ext?: string | null;
  sort_order: number;
  grade?: number | null;
  subject?: string | null;
  resource_type?: string | null;
  edition?: string | null;
  region?: string | null;
  year?: number | null;
  has_answer?: boolean;
  source_pan_type?: string | null;
  source_pan_url?: string | null;
}

export interface Resource {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  channel_id?: string;
  category_id?: string;
  topic_ids?: string[];
  tags: string[];
  cover: string;
  quark_url?: string;
  extract_code?: string;
  publish_status: PublishStatus;
  published_at: string;
  updated_at: string;
  created_at?: string;
  meta?: Record<string, ResourceMetaValue>;
  items?: ResourceItem[];
}

export type TrackEventName =
  | "search_submit"
  | "search_result_click"
  | "resource_detail_view"
  | "outbound_quark_click"
  | "outbound_quark_redirect_done";

export interface TrackEvent {
  name: TrackEventName;
  event_time: string;
  session_id?: string;
  anon_user_id?: string;
  query?: string;
  resource_id?: string;
  result_rank?: number;
  result_count?: number;
  from_page?: string;
  referer?: string;
  device?: string;
  ua?: string;
}

export interface SearchResult {
  item: Resource;
  score: number;
}

export interface SearchResponse {
  items: Resource[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export interface CsvImportResult {
  successCount: number;
  failureCount: number;
  failures: Array<{
    row: number;
    reason: string;
  }>;
}

export type FeedbackReason = "expired" | "wrong_file" | "extract_error" | "other";

export interface Feedback {
  id: string;
  resource_id: string;
  resource_title: string;
  resource_slug: string;
  reason: FeedbackReason;
  note?: string;
  created_at: string;
  resolved: boolean;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort: number;
  featured?: boolean;
  status: "active" | "hidden";
}

export interface CategoryNode {
  id: string;
  channel_id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description: string;
  sort: number;
  featured?: boolean;
  show_on_home?: boolean;
  status: "active" | "hidden";
}

export interface TopicNode {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  summary: string;
  download_url?: string;
  sort: number;
  featured?: boolean;
  show_on_home?: boolean;
  status: "active" | "hidden";
  field_schema?: TopicFieldSchema[];
}

export interface ContentStructure {
  site_profile: {
    name: string;
    tagline: string;
    short_link: string;
    positioning: string;
    featured_message?: string;
    hot_searches?: string[];
    /** 首页「优先浏览」区：手动指定的频道 slug 列表（有序）。空时自动取 featured=1 的频道 */
    featured_channels?: string[];
    /** 首页「热门标签」区：手动指定的标签名列表。空时自动取统计热度前 N */
    hot_tags?: string[];
  };
  channels: Channel[];
  categories: CategoryNode[];
  topics: TopicNode[];
}
