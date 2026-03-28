CREATE TABLE IF NOT EXISTS site_profile (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  tagline VARCHAR(255) NOT NULL,
  short_link VARCHAR(255) NOT NULL,
  positioning TEXT NOT NULL,
  featured_message VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','hidden') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  channel_id VARCHAR(64) NOT NULL,
  parent_id VARCHAR(64) NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  show_on_home TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','hidden') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  category_id VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  download_url VARCHAR(1000) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','hidden') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_topics_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resources (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  category VARCHAR(160) NOT NULL,
  channel_id VARCHAR(64) NULL,
  category_id VARCHAR(64) NULL,
  cover VARCHAR(500) NOT NULL,
  quark_url VARCHAR(1000) NULL,
  extract_code VARCHAR(80) NULL,
  publish_status ENUM('draft','published','offline') NOT NULL DEFAULT 'draft',
  published_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resources_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
  CONSTRAINT fk_resources_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_resources_status_updated (publish_status, updated_at),
  INDEX idx_resources_channel (channel_id),
  INDEX idx_resources_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resource_tags (
  resource_id VARCHAR(64) NOT NULL,
  tag_name VARCHAR(120) NOT NULL,
  tag_slug VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (resource_id, tag_slug),
  CONSTRAINT fk_resource_tags_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  INDEX idx_resource_tags_slug (tag_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resource_topics (
  resource_id VARCHAR(64) NOT NULL,
  topic_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (resource_id, topic_id),
  CONSTRAINT fk_resource_topics_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_resource_topics_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  INDEX idx_resource_topics_topic (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS track_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  event_time DATETIME NOT NULL,
  session_id VARCHAR(120) NULL,
  anon_user_id VARCHAR(120) NULL,
  query_text VARCHAR(255) NULL,
  resource_id VARCHAR(64) NULL,
  result_rank INT NULL,
  result_count INT NULL,
  from_page VARCHAR(255) NULL,
  referer VARCHAR(1000) NULL,
  device VARCHAR(120) NULL,
  ua VARCHAR(1000) NULL,
  INDEX idx_track_events_name_time (name, event_time),
  INDEX idx_track_events_query (query_text),
  INDEX idx_track_events_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  resource_id VARCHAR(64) NOT NULL,
  resource_title VARCHAR(255) NOT NULL,
  resource_slug VARCHAR(255) NOT NULL,
  reason ENUM('expired','wrong_file','extract_error','other') NOT NULL,
  note VARCHAR(200) NULL,
  created_at DATETIME NOT NULL,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_feedback_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  INDEX idx_feedback_created (created_at),
  INDEX idx_feedback_resolved (resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
