// =============================================================================
// OneNumbr — Validation schemas (zod)
// Shared between client forms and server API routes.
// =============================================================================

import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please enter a valid email address.")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Please enter your full name.")
      .max(80, "Name is too long."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const profileSetupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(80, "Name is too long."),
  country: z
    .string()
    .trim()
    .length(2, "Please select your country.")
    .regex(/^[A-Z]{2}$/, "Please select your country."),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number is too long.")
    .regex(/^[+0-9()\-\s]*$/, "Phone number contains invalid characters.")
    .optional()
    .or(z.literal("")),
  timezone: z.string().trim().max(64).optional().or(z.literal("")),
});

export const profileUpdateSchema = profileSetupSchema.partial();

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileSetupInput = z.infer<typeof profileSetupSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Flatten a ZodError to a single first-error message for toasts/forms. */
export function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the entered information.";
}
