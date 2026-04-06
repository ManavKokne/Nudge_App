import { socialPool } from "@/lib/db/social";

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
