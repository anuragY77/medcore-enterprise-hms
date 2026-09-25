import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "SYSTEM",
  "APPOINTMENT",
  "PATIENT",
  "BILLING",
  "SECURITY",
] as const;

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be at most 100")
    .default(20),
  read: z.enum(["true", "false"], { message: "Invalid read value" }).optional(),
  type: z.enum(NOTIFICATION_TYPES, { message: "Invalid notification type" }).optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const createNotificationSchema = z.object({
  recipientId: z.string().uuid({ message: "Invalid recipient ID" }),
  title: z.string().min(1, "Title is required").max(200),
  message: z.string().min(1, "Message is required").max(2000),
  type: z.enum(NOTIFICATION_TYPES, { message: "Invalid notification type" }).default("SYSTEM"),
  action: z.string().max(500).optional().nullable(),
});

export type CreateNotificationData = z.infer<typeof createNotificationSchema>;

export const notificationIdSchema = z.string().uuid({ message: "Invalid notification ID" });
