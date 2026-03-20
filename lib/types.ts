export type PublishStatus = "draft" | "published" | "offline";

export interface Resource {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  tags: string[];
  cover: string;
  quark_url: string;
  extract_code?: string;
  publish_status: PublishStatus;
  published_at: string;
  updated_at: string;
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
