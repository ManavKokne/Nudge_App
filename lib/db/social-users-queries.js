import { socialQuery } from "@/lib/db/social";

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
