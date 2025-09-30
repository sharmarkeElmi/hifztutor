// features/settings/lib/schemas.ts
import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().min(2),
  displayName: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    message: "Passwords must match",
    path: ["confirmNewPassword"],
  });

export const emailChangeSchema = z
  .object({
    currentEmail: z.string().email(),
    newEmail: z.string().email(),
  })
  .superRefine((values, ctx) => {
    if (values.currentEmail === values.newEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newEmail"],
        message: "New email must be different",
      });
    }
  });

export const notificationsSchema = z.object({
  marketingEmails: z.boolean(),
  lessonReminders: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type EmailChangeInput = z.infer<typeof emailChangeSchema>;
export type NotificationsInput = z.infer<typeof notificationsSchema>;
