import { socialQuery } from "@/lib/db/social";

function resolvePostStatus(processingMode, explicitStatus) {
  if (explicitStatus === "pending" || explicitStatus === "done") {
    return explicitStatus;
  }

  return String(processingMode || "mock").toLowerCase() === "ml" ? "pending" : "done";
}

const POST_SELECT = `SELECT p.id,
            p.content,
            p.phone_number,
            p.created_at,
            p.updated_at,
            p.upvotes,
            p.downvotes,
            p.extracted_location,
            p.extracted_city,
            p.extracted_request_type,
            p.extracted_is_informative,
            p.extraction_confidence,
            p.urgency_score,
            p.urgency_label,
            p.processing_mode,
            COALESCE(p.status, CASE WHEN LOWER(p.processing_mode) = 'ml' THEN 'pending' ELSE 'done' END) AS status,
            u.id AS user_id,
            u.email AS author_email,
            COALESCE(NULLIF(TRIM(u.name), ''), INITCAP(SPLIT_PART(u.email, '@', 1))) AS author_name,
            u.avatar_url AS author_avatar,
            COALESCE((
              SELECT COUNT(*)::int
              FROM comments c
              WHERE c.post_id = p.id
            ), 0) AS comment_count
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id`;

export async function createPost({ userId, content, processingMode = "mock", status, phoneNumber }) {
  const normalizedMode = String(processingMode || "mock").toLowerCase();
  const normalizedStatus = resolvePostStatus(normalizedMode, status);
  const normalizedPhoneNumber = phoneNumber?.trim() || null;

  const result = await socialQuery(
    `INSERT INTO posts (user_id, content, processing_mode, status, phone_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, content, processing_mode, status, phone_number, created_at, updated_at, upvotes, downvotes,
               extracted_location, extracted_city, extracted_request_type, extracted_is_informative, extraction_confidence,
               urgency_score, urgency_label`,
    [userId, content, normalizedMode, normalizedStatus, normalizedPhoneNumber]
  );

  return result.rows[0];
}

export async function updatePostProcessingMeta(postId, meta) {
  const setClauses = [];
  const values = [];

  if (meta.location !== undefined) {
    values.push(meta.location);
    setClauses.push(`extracted_location = $${values.length}`);
  }

  if (meta.city !== undefined) {
    values.push(meta.city);
    setClauses.push(`extracted_city = $${values.length}`);
  }

  if (meta.requestType !== undefined) {
    values.push(meta.requestType);
    setClauses.push(`extracted_request_type = $${values.length}`);
  }

  if (meta.isInformative !== undefined) {
    values.push(meta.isInformative);
    setClauses.push(`extracted_is_informative = $${values.length}`);
  }

  if (meta.informativeConfidence !== undefined) {
    values.push(meta.informativeConfidence);
    setClauses.push(`extraction_confidence = $${values.length}`);
  }

  if (meta.urgencyScore !== undefined) {
    values.push(meta.urgencyScore);
    setClauses.push(`urgency_score = $${values.length}`);
  }

  if (meta.urgencyLabel !== undefined) {
    values.push(meta.urgencyLabel);
    setClauses.push(`urgency_label = $${values.length}`);
  }

  if (!setClauses.length) {
    return null;
  }

  values.push(postId);

  const result = await socialQuery(
    `UPDATE posts
     SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id, extracted_location, extracted_city, extracted_request_type, extracted_is_informative, extraction_confidence,
               urgency_score, urgency_label`,
    values
  );

  return result.rows[0] || null;
}

export async function listPosts({ limit = 20, offset = 0 } = {}) {
  const result = await socialQuery(
    `${POST_SELECT}
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
}

export async function getPostById(postId) {
  const result = await socialQuery(
    `${POST_SELECT}
     WHERE p.id = $1`,
    [postId]
  );

  return result.rows[0] || null;
}

export async function getLatestSosPostByUser(userId) {
  const result = await socialQuery(
    `SELECT id, created_at
     FROM posts
     WHERE user_id = $1
       AND (
         extracted_request_type = 'Emergency'
         OR content LIKE 'SOS Alert:%'
       )
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

export async function updatePostContent({ postId, content }) {
  const result = await socialQuery(
    `UPDATE posts
     SET content = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [postId, content]
  );

  return result.rows[0] || null;
}

export async function deletePostById(postId) {
  const result = await socialQuery(
    `DELETE FROM posts
     WHERE id = $1
     RETURNING id`,
    [postId]
  );

  return result.rows[0] || null;
}
