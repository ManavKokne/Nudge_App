import { socialQuery } from "@/lib/db/social";

export async function findUserByEmail(email) {
  const result = await socialQuery(
    `SELECT id, email, password_hash, avatar_url, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

export async function findUserById(userId) {
  const result = await socialQuery(
    `SELECT id, email, avatar_url, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

export async function createUser({ email, passwordHash, avatarUrl }) {
  const result = await socialQuery(
    `INSERT INTO users (email, password_hash, avatar_url)
     VALUES ($1, $2, $3)
     RETURNING id, email, avatar_url, created_at`,
    [email, passwordHash, avatarUrl]
  );

  return result.rows[0];
}

export async function updateUserProfile(userId, { email, avatarUrl }) {
  const setClauses = [];
  const values = [];

  if (email !== undefined) {
    values.push(email);
    setClauses.push(`email = $${values.length}`);
  }

  if (avatarUrl !== undefined) {
    values.push(avatarUrl);
    setClauses.push(`avatar_url = $${values.length}`);
  }

  if (!setClauses.length) {
    return findUserById(userId);
  }

  values.push(userId);

  const result = await socialQuery(
    `UPDATE users
     SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING id, email, avatar_url, created_at`,
    values
  );

  return result.rows[0] || null;
}

export async function createPost({ userId, content, processingMode = "mock" }) {
  const result = await socialQuery(
    `INSERT INTO posts (user_id, content, processing_mode)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, content, processing_mode, created_at, updated_at, upvotes, downvotes,
               extracted_location, extracted_request_type, urgency_score, urgency_label`,
    [userId, content, processingMode]
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

  if (meta.requestType !== undefined) {
    values.push(meta.requestType);
    setClauses.push(`extracted_request_type = $${values.length}`);
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
     RETURNING id, extracted_location, extracted_request_type, urgency_score, urgency_label`,
    values
  );

  return result.rows[0] || null;
}

export async function listPosts({ limit = 20, offset = 0 } = {}) {
  const result = await socialQuery(
    `SELECT p.id,
            p.content,
            p.created_at,
            p.updated_at,
            p.upvotes,
            p.downvotes,
            p.extracted_location,
            p.extracted_request_type,
            p.urgency_score,
            p.urgency_label,
            p.processing_mode,
            u.id AS user_id,
            u.email AS author_email,
            u.avatar_url AS author_avatar,
            COALESCE((
              SELECT COUNT(*)::int
              FROM comments c
              WHERE c.post_id = p.id
            ), 0) AS comment_count
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows;
}

export async function getPostById(postId) {
  const result = await socialQuery(
    `SELECT p.id,
            p.content,
            p.created_at,
            p.updated_at,
            p.upvotes,
            p.downvotes,
            p.extracted_location,
            p.extracted_request_type,
            p.urgency_score,
            p.urgency_label,
            p.processing_mode,
            u.id AS user_id,
            u.email AS author_email,
            u.avatar_url AS author_avatar,
            COALESCE((
              SELECT COUNT(*)::int
              FROM comments c
              WHERE c.post_id = p.id
            ), 0) AS comment_count
     FROM posts p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [postId]
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

export async function createComment({ postId, userId, content }) {
  const result = await socialQuery(
    `INSERT INTO comments (post_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, post_id, user_id, content, created_at`,
    [postId, userId, content]
  );

  return result.rows[0];
}

export async function listCommentsByPost(postId) {
  const result = await socialQuery(
    `SELECT c.id,
            c.post_id,
            c.content,
            c.created_at,
            u.id AS user_id,
            u.email AS author_email,
            u.avatar_url AS author_avatar
     FROM comments c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId]
  );

  return result.rows;
}

export async function incrementPostFeedback(postId, direction) {
  const column = direction === "up" ? "upvotes" : "downvotes";

  const result = await socialQuery(
    `UPDATE posts
     SET ${column} = ${column} + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, upvotes, downvotes`,
    [postId]
  );

  return result.rows[0] || null;
}
