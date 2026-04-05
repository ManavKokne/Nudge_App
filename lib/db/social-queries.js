import { socialPool, socialQuery } from "@/lib/db/social";

function resolvePostStatus(processingMode, explicitStatus) {
  if (explicitStatus === "pending" || explicitStatus === "done") {
    return explicitStatus;
  }

  return String(processingMode || "mock").toLowerCase() === "ml" ? "pending" : "done";
}

export async function findUserByEmail(email) {
  const result = await socialQuery(
    `SELECT id, name, email, password_hash, avatar_url, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

export async function findUserById(userId) {
  const result = await socialQuery(
    `SELECT id, name, email, avatar_url, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

export async function createUser({ name, email, passwordHash, avatarUrl }) {
  const result = await socialQuery(
    `INSERT INTO users (name, email, password_hash, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, avatar_url, created_at`,
    [name, email, passwordHash, avatarUrl]
  );

  return result.rows[0];
}

export async function updateUserProfile(userId, { name, email, avatarUrl }) {
  const setClauses = [];
  const values = [];

  if (name !== undefined) {
    values.push(name);
    setClauses.push(`name = $${values.length}`);
  }

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
     RETURNING id, name, email, avatar_url, created_at`,
    values
  );

  return result.rows[0] || null;
}

export async function createPost({ userId, content, processingMode = "mock", status, phoneNumber }) {
  const normalizedMode = String(processingMode || "mock").toLowerCase();
  const normalizedStatus = resolvePostStatus(normalizedMode, status);
  const normalizedPhoneNumber = phoneNumber?.trim() || null;

  const result = await socialQuery(
    `INSERT INTO posts (user_id, content, processing_mode, status, phone_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, content, processing_mode, status, phone_number, created_at, updated_at, upvotes, downvotes,
               extracted_location, extracted_city, extracted_request_type, urgency_score, urgency_label`,
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
     RETURNING id, extracted_location, extracted_city, extracted_request_type, urgency_score, urgency_label`,
    values
  );

  return result.rows[0] || null;
}

export async function listPosts({ limit = 20, offset = 0 } = {}) {
  const result = await socialQuery(
    `SELECT p.id,
            p.content,
            p.phone_number,
            p.created_at,
            p.updated_at,
            p.upvotes,
            p.downvotes,
            p.extracted_location,
            p.extracted_city,
            p.extracted_request_type,
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
            p.phone_number,
            p.created_at,
            p.updated_at,
            p.upvotes,
            p.downvotes,
            p.extracted_location,
            p.extracted_city,
            p.extracted_request_type,
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
     INNER JOIN users u ON u.id = p.user_id
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
                 COALESCE(NULLIF(TRIM(u.name), ''), INITCAP(SPLIT_PART(u.email, '@', 1))) AS author_name,
            u.avatar_url AS author_avatar
     FROM comments c
     INNER JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId]
  );

  return result.rows;
}

export async function setPostFeedback({ postId, userId, direction }) {
  const client = await socialPool.connect();

  try {
    await client.query("BEGIN");

    const postResult = await client.query(
      `SELECT id
       FROM posts
       WHERE id = $1
       FOR UPDATE`,
      [postId]
    );

    if (!postResult.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const existingResult = await client.query(
      `SELECT direction
       FROM post_feedback
       WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );

    const existingDirection = existingResult.rows[0]?.direction || null;

    if (!existingDirection) {
      await client.query(
        `INSERT INTO post_feedback (post_id, user_id, direction)
         VALUES ($1, $2, $3)`,
        [postId, userId, direction]
      );

      if (direction === "up") {
        await client.query(
          `UPDATE posts
           SET upvotes = upvotes + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [postId]
        );
      } else {
        await client.query(
          `UPDATE posts
           SET downvotes = downvotes + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [postId]
        );
      }
    } else if (existingDirection !== direction) {
      await client.query(
        `UPDATE post_feedback
         SET direction = $3
         WHERE post_id = $1 AND user_id = $2`,
        [postId, userId, direction]
      );

      if (direction === "up") {
        await client.query(
          `UPDATE posts
           SET upvotes = upvotes + 1,
               downvotes = GREATEST(downvotes - 1, 0),
               updated_at = NOW()
           WHERE id = $1`,
          [postId]
        );
      } else {
        await client.query(
          `UPDATE posts
           SET downvotes = downvotes + 1,
               upvotes = GREATEST(upvotes - 1, 0),
               updated_at = NOW()
           WHERE id = $1`,
          [postId]
        );
      }
    }

    const countsResult = await client.query(
      `SELECT upvotes, downvotes
       FROM posts
       WHERE id = $1`,
      [postId]
    );

    await client.query("COMMIT");

    return {
      id: postId,
      direction,
      upvotes: countsResult.rows[0]?.upvotes || 0,
      downvotes: countsResult.rows[0]?.downvotes || 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
