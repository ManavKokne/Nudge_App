export async function runMlProcessing(post) {
  return {
    mode: "ml",
    postId: post.id,
    note: "Post persisted only in social database. Disaster writes are intentionally skipped.",
  };
}
