import { FollowupChannel } from "@prisma/client";
import { z } from "zod";

export const SubmitEnquirySchema = z.object({
  propertyId: z.string().uuid(),
  tenantName: z.string().min(2).max(120),
  tenantPhone: z
    .string()
    .regex(
      /^\+?[0-9]{10,15}$/,
      "Valid phone number required for WhatsApp/call follow-up",
    ),
  tenantEmail: z.string().email().optional(),
  message: z.string().max(1500).optional(),
  preferredMoveIn: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  occupancyPreference: z.string().max(80).optional(),
});

export const LogFollowupSchema = z.object({
  channel: z.nativeEnum(FollowupChannel),
  outcomeStatus: z.string().min(2).max(80),
  notes: z.string().min(5),
  nextFollowupAt: z.string().datetime().optional(),
  updatedEnquiryStatus: z
    .enum([
      "ASSIGNED",
      "IN_FOLLOWUP",
      "VISIT_SCHEDULED",
      "CONVERTED",
      "CLOSED_LOST",
    ])
    .optional(),
});
