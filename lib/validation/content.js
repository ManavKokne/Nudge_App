import { z } from "zod";

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(5, "Post must be at least 5 characters")
    .max(3000, "Post cannot exceed 3000 characters"),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

export const feedbackSchema = z.object({
  direction: z.enum(["up", "down"]),
});
