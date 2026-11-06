import { z } from 'zod';

export const SubmitEnquirySchema = z.object({
  propertyId: z.uuid(),
  tenantName: z.string().trim().min(1).max(120),
  tenantPhone: z.string().trim().min(7).max(20),
  tenantEmail: z.email().optional(),
  message: z.string().trim().max(5000).optional(),
  preferredMoveIn: z.iso.date().optional(),
  occupancyPreference: z.string().trim().max(80).optional(),
});

export const LogFollowupSchema = z.object({
  channel: z.enum(['EMAIL', 'WHATSAPP', 'PHONE_CALL', 'ON_SITE']),
  outcomeStatus: z.string().trim().min(1).max(80),
  notes: z.string().trim().min(1).max(5000),
  nextFollowupAt: z.iso.datetime({ offset: true }).optional(),
  updatedEnquiryStatus: z.enum(['NEW', 'ASSIGNED', 'FOLLOWUP', 'VISIT', 'ENQUIRY_CLOSED']).optional(),
});
