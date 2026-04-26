import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  username: z
    .string()
    .trim()
    .min(3, "Username must be 3+ chars")
    .max(20, "Username max 20 chars")
    .regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscores only"),
  displayName: z.string().trim().min(1, "Required").max(50),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Required"),
});

export const captionSchema = z.string().trim().max(500, "Caption too long").optional();
export const commentSchema = z.string().trim().min(1, "Empty").max(1000, "Too long");
