import { socialQuery } from "@/lib/db/social";

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
