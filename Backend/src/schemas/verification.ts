import { z } from 'zod';

export const CompleteVerificationSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    verifiedOwnerId: z.uuid().optional(),
    notes: z.string().trim().max(5000).optional(),
    rejectionReason: z.string().trim().min(1).max(2000).optional(),
  })
  .refine(
    (value) => value.decision !== 'REJECTED' || Boolean(value.rejectionReason),
    {
      message: 'rejectionReason is required when the verification is rejected',
      path: ['rejectionReason'],
    },
  );
