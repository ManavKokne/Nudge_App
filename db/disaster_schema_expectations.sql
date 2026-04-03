-- This file documents the minimum columns expected in public.tweets for mock mode.
-- Existing dashboard schemas can vary (tweet/content, request_type/category), and
-- the app dynamically adapts to common aliases.

-- Required logical fields:
-- 1) content: one of content | tweet | text | body
-- 2) location: location
-- 3) request_type: one of request_type | category | type
-- 4) urgency: urgency
-- 5) created_at for 1-hour frequency window: one of created_at | timestamp | inserted_at

-- Optional but recommended:
-- urgency_score INTEGER
-- urgency_label TEXT
-- source_post_id UUID/TEXT

-- Example compatible schema:
-- CREATE TABLE public.tweets (
--   id BIGSERIAL PRIMARY KEY,
--   content TEXT NOT NULL,
--   location TEXT NOT NULL,
--   request_type TEXT NOT NULL,
--   urgency TEXT NOT NULL CHECK (urgency IN ('urgent', 'non-urgent')),
--   urgency_score INTEGER,
--   urgency_label TEXT,
--   source_post_id UUID,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
