import { PropertyStatus } from '@prisma/client';
import { Response, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/auth';
import { AuthenticatedRequest, requireRole } from '../middleware/requireRole';
import { CompleteVerificationSchema } from '../schemas/verification';
import prisma from '../utils/prisma';

const router = Router();

router.post(
  '/api/admin/properties/:id/start-verification',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const propertyId = z.uuid().safeParse(req.params.id);
    if (!propertyId.success) {
      return res.status(400).json({ success: false, error: 'Invalid property ID' });
    }
    const adminId = req.user?.id;
    if (!adminId || !z.uuid().safeParse(adminId).success) {
      return res.status(401).json({ success: false, error: 'Authenticated admin ID is invalid' });
    }

    try {
      const property = await prisma.property.findFirst({
        where: { id: propertyId.data, deletedAt: null },
      });
      if (!property) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }
      if (
        property.verificationStatus === PropertyStatus.VERIFIED ||
        property.verificationStatus === PropertyStatus.UNDER_VERIFICATION
      ) {
        return res.status(409).json({
          success: false,
          error: `Cannot start verification while property is ${property.verificationStatus}`,
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedProperty = await tx.property.update({
          where: { id: property.id },
          data: { verificationStatus: PropertyStatus.UNDER_VERIFICATION },
        });
        const verification = await tx.propertyVerification.create({
          data: {
            propertyId: property.id,
            reviewedByUserId: adminId,
            decision: PropertyStatus.UNDER_VERIFICATION,
            notes: 'Verification started',
          },
        });
        await tx.propertyStatusHistory.create({
          data: {
            propertyId: property.id,
            changedByUserId: adminId,
            fromStatus: property.verificationStatus,
            toStatus: PropertyStatus.UNDER_VERIFICATION,
            reason: 'Formal property verification started',
          },
        });
        return { property: updatedProperty, verification };
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('Failed to start property verification:', error);
      return res.status(500).json({ success: false, error: 'Failed to start verification' });
    }
  },
);

router.post(
  '/api/admin/properties/:id/complete-verification',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const propertyId = z.uuid().safeParse(req.params.id);
    if (!propertyId.success) {
      return res.status(400).json({ success: false, error: 'Invalid property ID' });
    }
    const adminId = req.user?.id;
    if (!adminId || !z.uuid().safeParse(adminId).success) {
      return res.status(401).json({ success: false, error: 'Authenticated admin ID is invalid' });
    }

    const parsedBody = CompleteVerificationSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, errors: parsedBody.error.issues });
    }
    const parsed = parsedBody.data;

    try {
      const property = await prisma.property.findFirst({
        where: { id: propertyId.data, deletedAt: null },
      });
      if (!property) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }
      if (property.verificationStatus !== PropertyStatus.UNDER_VERIFICATION) {
        return res.status(409).json({
          success: false,
          error: 'Start verification before recording its outcome',
        });
      }

      if (parsed.verifiedOwnerId) {
        const owner = await prisma.user.findFirst({
          where: {
            id: parsed.verifiedOwnerId,
            role: 'PROPERTY_OWNER',
            isActive: true,
          },
          select: { id: true },
        });
        if (!owner) {
          return res.status(400).json({
            success: false,
            error: 'verifiedOwnerId must reference an active property owner',
          });
        }
      }

      const approved = parsed.decision === 'APPROVED';
      const nextStatus = approved ? PropertyStatus.VERIFIED : PropertyStatus.REJECTED;

      const result = await prisma.$transaction(async (tx) => {
        const verification = await tx.propertyVerification.create({
          data: {
            propertyId: property.id,
            reviewedByUserId: adminId,
            decision: nextStatus,
            notes: approved ? parsed.notes : parsed.rejectionReason,
          },
        });

        const updatedProperty = await tx.property.update({
          where: { id: property.id },
          data: {
            verificationStatus: nextStatus,
            isPublished: approved ? property.isPublished : false,
            label: approved ? 'PGfy Verified' : 'PGfy Not Verified',
            verifiedOwnerId: approved ? parsed.verifiedOwnerId ?? property.verifiedOwnerId : null,
            verifiedAt: approved ? new Date() : null,
          },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId: property.id,
            changedByUserId: adminId,
            fromStatus: property.verificationStatus,
            toStatus: nextStatus,
            reason: approved
              ? parsed.notes ?? 'Property verification approved'
              : parsed.rejectionReason,
          },
        });

        return { property: updatedProperty, verification };
      });

      return res.json({
        success: true,
        message: approved
          ? 'Property verification approved'
          : 'Property verification rejected and the listing unpublished',
        data: result,
      });
    } catch (error) {
      console.error('Failed to complete property verification:', error);
      return res.status(500).json({ success: false, error: 'Failed to complete verification' });
    }
  },
);

export default router;
