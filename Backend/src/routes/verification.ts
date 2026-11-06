import { VerifyDecision, VerifyStatus } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../infrastructure/prisma";
import { AuthenticatedRequest, requireRole } from "../middleware/requireRole";
import { CompleteVerificationSchema } from "../schemas/verification";

const router = Router();

router.post(
  "/api/admin/properties/:id/start-verification",
  requireRole(["ADMIN"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const propertyId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!propertyId) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid property ID" });
      }
      const adminId = req.user!.id;

      const property = await prisma.property.findFirst({
        where: { id: propertyId, deletedAt: null },
      });

      if (!property) {
        return res
          .status(404)
          .json({ success: false, error: "Property not found" });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedProp = await tx.property.update({
          where: { id: propertyId },
          data: { verificationStatus: VerifyStatus.UNDER_VERIFICATION },
        });

        const verificationRecord = await tx.propertyVerification.create({
          data: {
            propertyId,
            reviewerAdminId: adminId,
            decision: VerifyDecision.PENDING,
          },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId,
            changedByUserId: adminId,
            fromStatus: property.verificationStatus,
            toStatus: VerifyStatus.UNDER_VERIFICATION,
            reason: "Initiated formal ownership & physical site verification",
          },
        });

        return { property: updatedProp, verification: verificationRecord };
      });

      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.post(
  "/api/admin/properties/:id/complete-verification",
  requireRole(["ADMIN"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const propertyId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!propertyId) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid property ID" });
      }
      const adminId = req.user!.id;
      const parsed = CompleteVerificationSchema.parse(req.body);

      const property = await prisma.property.findFirst({
        where: { id: propertyId, deletedAt: null },
      });

      if (!property) {
        return res
          .status(404)
          .json({ success: false, error: "Property not found" });
      }

      const isApproved = parsed.decision === "APPROVED";
      const targetStatus = isApproved
        ? VerifyStatus.VERIFIED
        : VerifyStatus.REJECTED;

      const result = await prisma.$transaction(async (tx) => {
        const verificationAudit = await tx.propertyVerification.create({
          data: {
            propertyId,
            reviewerAdminId: adminId,
            ownershipDocVerified: parsed.ownershipDocVerified,
            ownershipDocUrl: parsed.ownershipDocUrl,
            physicalInspectionPassed: parsed.physicalInspectionPassed,
            amenitiesConfirmed: parsed.amenitiesConfirmed,
            decision: isApproved
              ? VerifyDecision.APPROVED
              : VerifyDecision.REJECTED,
            rejectionReason: isApproved ? null : parsed.rejectionReason,
            inspectionNotes: parsed.inspectionNotes,
            inspectedAt: new Date(),
          },
        });

        const updatedProperty = await tx.property.update({
          where: { id: propertyId },
          data: {
            verificationStatus: targetStatus,

            isPublished: isApproved ? true : false,
            badgeLabel: isApproved ? "PGfy Verified" : "PGfy Not Verified",
            verifiedOwnerId: isApproved
              ? parsed.verifiedOwnerId || property.verifiedOwnerId
              : null,
            verifiedAt: isApproved ? new Date() : null,
          },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId,
            changedByUserId: adminId,
            fromStatus: property.verificationStatus,
            toStatus: targetStatus,
            reason: isApproved
              ? "Property passed verification and converted in-place to PGfy Verified"
              : `Verification rejected: ${parsed.rejectionReason}`,
          },
        });

        return { property: updatedProperty, verificationAudit };
      });

      return res.json({
        success: true,
        message: isApproved
          ? "Property successfully converted to PGfy Verified in-place. All historical enquiries remain linked."
          : "Property verification rejected and unpublished from tenant discovery.",
        data: result,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, errors: err.issues });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
