import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long");

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(60, "Name is too long");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: z
    .string()
    .regex(/^\/avatar\/av_\d+\.png$/, "Avatar path must match /avatar/av_X.png")
    .optional(),
});
