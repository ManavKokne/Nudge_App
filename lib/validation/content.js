import { z } from "zod";

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(7, "Phone number must be at least 7 digits")
  .max(20, "Phone number is too long")
  .regex(/^\+?[0-9][0-9()\-\s]{6,19}$/, "Please enter a valid phone number");

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(5, "Post must be at least 5 characters")
    .max(3000, "Post cannot exceed 3000 characters"),
  phoneNumber: phoneNumberSchema.optional(),
});

export const updatePostSchema = z.object({
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
