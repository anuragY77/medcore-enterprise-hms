import "@/lib/zod-csp";

import { z } from "zod";
import { dateFieldSchema } from "./common";

export const appointmentSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  doctorName: z.string().min(1, "Doctor name is required").max(200),
  department: z.string().min(1, "Department is required").max(100),
  date: dateFieldSchema("Date is required"),
  time: z.string().min(1, "Time is required").max(20),
  type: z.enum(["Consultation", "Follow-up", "Emergency"], {
    message: "Appointment type is required",
  }),
  status: z.enum(["Scheduled", "Confirmed", "Completed", "Cancelled"], {
    message: "Status is required",
  }),
  reason: z.string().max(20000).optional(),
  notes: z.string().max(20000).optional(),
});

export type AppointmentFormData = z.infer<typeof appointmentSchema>;

export const appointmentSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.enum(["All", "Scheduled", "Confirmed", "Completed", "Cancelled"]).default("All"),
  department: z.string().optional(),
  doctorName: z.string().optional(),
  date: z.string().optional(),
  page: z.coerce.number({ message: "Page must be a number" }).int().min(1).max(100000).default(1),
  limit: z.coerce.number({ message: "Limit must be a number" }).int().min(1).max(100).default(20),
});

export type AppointmentSearchData = z.infer<typeof appointmentSearchSchema>;
