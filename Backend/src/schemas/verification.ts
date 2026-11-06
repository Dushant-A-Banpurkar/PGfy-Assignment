import { z } from "zod";

export const CompleteVerificationSchema = z
  .object({
    ownershipDocVerified: z.boolean(),
    ownershipDocUrl: z.string().url().optional(),
    physicalInspectionPassed: z.boolean(),
    amenitiesConfirmed: z.boolean(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().optional(),
    inspectionNotes: z.string().optional(),
    verifiedOwnerId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "APPROVED") {
      if (
        !data.ownershipDocVerified ||
        !data.physicalInspectionPassed ||
        !data.amenitiesConfirmed
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["decision"],
          message:
            "Cannot APPROVE property unless ownershipDocVerified, physicalInspectionPassed, and amenitiesConfirmed are all true.",
        });
      }
    }
    if (
      data.decision === "REJECTED" &&
      (!data.rejectionReason || data.rejectionReason.trim().length < 5)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message:
          "A detailed rejectionReason is mandatory when rejecting a property verification.",
      });
    }
  });
