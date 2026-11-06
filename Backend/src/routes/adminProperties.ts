import { CategoryProp, Prisma, PropertyStatus } from '@prisma/client';
import { Response, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/auth';
import { AuthenticatedRequest, requireRole } from '../middleware/requireRole';
import { CreateUnverifiedPropertySchema, UpdatePropertySchema } from '../schemas/property';
import prisma from '../utils/prisma';

const router = Router();

function makeDedupKey(ownerPhone: string, pincode: string, name: string): string {
  const phone = ownerPhone.replace(/\D/g, '');
  const normalizedName = name.normalize('NFKC').trim().toLocaleLowerCase('en');
  return `${phone}|${pincode.trim().toLowerCase()}|${normalizedName}`;
}

router.post(
  '/api/admin/properties',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsedBody = CreateUnverifiedPropertySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, errors: parsedBody.error.issues });
    }

    const adminId = req.user?.id;
    if (!adminId || !z.uuid().safeParse(adminId).success) {
      return res.status(401).json({ success: false, error: 'Authenticated admin ID is invalid' });
    }

    const parsed = parsedBody.data;
    const normalizedDedupKey = makeDedupKey(parsed.ownerContactPhone, parsed.pincode, parsed.name);

    try {
      const duplicate = await prisma.property.findFirst({
        where: { normalizedDedupKey, deletedAt: null },
        select: {
          id: true,
          name: true,
          verificationStatus: true,
          city: true,
          locality: true,
        },
      });

      if (duplicate && !parsed.forceCreateIgnoreDuplicateWarning) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_PROPERTY_WARNING',
          message: 'A potentially matching property already exists.',
          existingMatch: duplicate,
        });
      }

      const initialStatus: PropertyStatus = parsed.publishImmediately
        ? PropertyStatus.PUBLISHED_UNVERIFIED
        : PropertyStatus.DRAFT;

      const property = await prisma.$transaction(async (tx) => {
        const created = await tx.property.create({
          data: {
            name: parsed.name,
            description: parsed.description,
            category: parsed.category as CategoryProp,
            verificationStatus: initialStatus,
            isPublished: parsed.publishImmediately,
            label: 'PGfy Not Verified',
            city: parsed.city,
            locality: parsed.locality,
            addressLine: parsed.addressLine,
            pincode: parsed.pincode,
            rentMin: parsed.rentMin,
            rentMax: parsed.rentMax,
            securityDeposit: parsed.securityDeposit,
            ownerContactName: parsed.ownerContactName,
            ownerContactPhone: parsed.ownerContactPhone,
            ownerContactEmail: parsed.ownerContactEmail,
            normalizedDedupKey,
            ...(parsed.categoryDetails
              ? { categoryDetails: parsed.categoryDetails as Prisma.InputJsonValue }
              : {}),
            amenities: parsed.amenities,
            createdByAdminId: adminId,
            ...(parsed.media.length
              ? {
                  media: {
                    create: parsed.media,
                  },
                }
              : {}),
          },
          include: { media: true },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId: created.id,
            changedByUserId: adminId,
            toStatus: initialStatus,
            reason: parsed.publishImmediately
              ? 'Created and published as an unverified listing'
              : 'Created as a draft unverified listing',
          },
        });

        return created;
      });

      return res.status(201).json({ success: true, data: property });
    } catch (error) {
      console.error('Failed to create property:', error);
      return res.status(500).json({ success: false, error: 'Failed to create property' });
    }
  },
);

router.patch(
  '/api/admin/properties/:id',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({ success: false, error: 'Invalid property ID' });
    }

    const parsedBody = UpdatePropertySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, errors: parsedBody.error.issues });
    }
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, error: 'Authentication required' });

    try {
      const existing = await prisma.property.findFirst({
        where: { id: id.data, deletedAt: null },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }

      const rentMin = parsedBody.data.rentMin ?? existing.rentMin;
      const rentMax = parsedBody.data.rentMax ?? existing.rentMax;
      if (rentMax < rentMin) {
        return res.status(400).json({
          success: false,
          errors: [{ path: ['rentMax'], message: 'rentMax must be greater than or equal to rentMin' }],
        });
      }

      const nextName = parsedBody.data.name ?? existing.name;
      const nextPhone = parsedBody.data.ownerContactPhone ?? existing.ownerContactPhone;
      const nextPincode = parsedBody.data.pincode ?? existing.pincode;
      const normalizedDedupKey = makeDedupKey(nextPhone, nextPincode, nextName);
      if (normalizedDedupKey !== existing.normalizedDedupKey) {
        const duplicate = await prisma.property.findFirst({
          where: {
            id: { not: existing.id },
            normalizedDedupKey,
            deletedAt: null,
          },
          select: { id: true, name: true, verificationStatus: true },
        });
        if (duplicate) {
          return res.status(409).json({
            success: false,
            code: 'DUPLICATE_PROPERTY_WARNING',
            message: 'A potentially matching property already exists.',
            existingMatch: duplicate,
          });
        }
      }

      const { categoryDetails, ...fields } = parsedBody.data;
      const updated = await prisma.property.update({
        where: { id: existing.id },
        data: {
          ...fields,
          ...(categoryDetails
            ? { categoryDetails: categoryDetails as Prisma.InputJsonValue }
            : {}),
          normalizedDedupKey,
        },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Failed to update property:', error);
      return res.status(500).json({ success: false, error: 'Failed to update property' });
    }
  },
);

router.patch(
  '/api/admin/properties/:id/publish',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({ success: false, error: 'Invalid property ID' });
    }

    const adminId = req.user?.id;
    if (!adminId || !z.uuid().safeParse(adminId).success) {
      return res.status(401).json({ success: false, error: 'Authenticated admin ID is invalid' });
    }

    try {
      const existing = await prisma.property.findFirst({
        where: { id: id.data, deletedAt: null },
      });
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }

      if (
        existing.verificationStatus === PropertyStatus.REJECTED ||
        existing.verificationStatus === PropertyStatus.HOLD
      ) {
        return res.status(409).json({
          success: false,
          error: `A property in ${existing.verificationStatus} status cannot be published`,
        });
      }

      const nextStatus =
        existing.verificationStatus === PropertyStatus.VERIFIED
          ? PropertyStatus.VERIFIED
          : existing.verificationStatus === PropertyStatus.UNDER_VERIFICATION
            ? PropertyStatus.UNDER_VERIFICATION
            : PropertyStatus.PUBLISHED_UNVERIFIED;

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.property.update({
          where: { id: id.data },
          data: {
            verificationStatus: nextStatus,
            isPublished: true,
            label:
              nextStatus === PropertyStatus.VERIFIED
                ? 'PGfy Verified'
                : 'PGfy Not Verified',
          },
        });

        if (!existing.isPublished || existing.verificationStatus !== nextStatus) {
          await tx.propertyStatusHistory.create({
            data: {
              propertyId: id.data,
              changedByUserId: adminId,
              fromStatus: existing.verificationStatus,
              toStatus: nextStatus,
              reason: 'Published property to tenant discovery',
            },
          });
        }

        return result;
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Failed to publish property:', error);
      return res.status(500).json({ success: false, error: 'Failed to publish property' });
    }
  },
);

router.delete(
  '/api/admin/properties/:id',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) {
      return res.status(400).json({ success: false, error: 'Invalid property ID' });
    }

    try {
      const result = await prisma.property.updateMany({
        where: { id: id.data, deletedAt: null },
        data: { deletedAt: new Date(), isPublished: false },
      });
      if (result.count === 0) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }
      return res.status(204).send();
    } catch (error) {
      console.error('Failed to archive property:', error);
      return res.status(500).json({ success: false, error: 'Failed to archive property' });
    }
  },
);

export default router;
