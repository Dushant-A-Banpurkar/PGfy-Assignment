import { PropertyCategory, VerifyStatus } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../infrastructure/prisma";
import { AuthenticatedRequest, requireRole } from "../middleware/requireRole";
import { CreateUnverifiedPropertySchema } from "../schemas/property";
import {
  computeNormalizedDedupKey,
  generatePropertySlug,
} from "../utils/property";

const router = Router();

router.post(
  "/api/admin/properties",
  requireRole(["ADMIN"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = CreateUnverifiedPropertySchema.parse(req.body);
      const adminId = req.user!.id;

      const dedupKey = computeNormalizedDedupKey(
        parsed.ownerContactPhone,
        parsed.pincode,
        parsed.title,
      );

      const existingDuplicates = await prisma.property.findMany({
        where: {
          deletedAt: null,
          OR: [
            { normalizedDedupKey: dedupKey },
            ...(parsed.latitude !== undefined && parsed.longitude !== undefined
              ? [
                  {
                    ownerContactPhone: parsed.ownerContactPhone,
                    latitude: {
                      gte: parsed.latitude - 0.00045,
                      lte: parsed.latitude + 0.00045,
                    }, // ~50m bounding box
                    longitude: {
                      gte: parsed.longitude - 0.00045,
                      lte: parsed.longitude + 0.00045,
                    },
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          verificationStatus: true,
          locality: true,
        },
      });

      if (
        existingDuplicates.length > 0 &&
        !parsed.forceCreateIgnoreDuplicateWarning
      ) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_PROPERTY_WARNING",
          message:
            "A potentially matching property with the same owner phone/location already exists. Pass forceCreateIgnoreDuplicateWarning: true to override.",
          existingMatches: existingDuplicates,
        });
      }

      const initialStatus = parsed.publishImmediately
        ? VerifyStatus.PUBLISHED_UNVERIFIED
        : VerifyStatus.DRAFT;

      const slug = generatePropertySlug(
        parsed.title,
        parsed.locality,
        parsed.city,
      );

      const createdProperty = await prisma.$transaction(async (tx) => {
        const prop = await tx.property.create({
          data: {
            slug,
            title: parsed.title,
            description: parsed.description,
            category: parsed.category,
            verificationStatus: initialStatus,
            isPublished: parsed.publishImmediately,
            badgeLabel: "PGfy Not Verified",
            city: parsed.city,
            locality: parsed.locality,
            addressLine: parsed.addressLine,
            pincode: parsed.pincode,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            rentMin: parsed.rentMin,
            rentMax: parsed.rentMax,
            securityDeposit: parsed.securityDeposit,
            ownerContactName: parsed.ownerContactName,
            ownerContactPhone: parsed.ownerContactPhone,
            ownerContactEmail: parsed.ownerContactEmail,
            normalizedDedupKey: dedupKey,
            categoryDetails: parsed.categoryDetails as any,
            amenities: parsed.amenities,
            createdByAdminId: adminId,
            media: {
              create: parsed.media.map((m) => ({
                mediaUrl: m.mediaUrl,
                mediaType: m.mediaType,
                isPrimary: m.isPrimary,
                sortOrder: m.sortOrder,
              })),
            },
          },
          include: { media: true },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId: prop.id,
            changedByUserId: adminId,
            fromStatus: null,
            toStatus: initialStatus,
            reason: parsed.publishImmediately
              ? "Admin created and immediately published unverified listing"
              : "Admin created unverified listing in DRAFT state",
          },
        });

        return prop;
      });

      return res.status(201).json({
        success: true,
        data: createdProperty,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, errors: err.issues });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.patch(
  "/api/admin/properties/:id/publish",
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

      const existing = await prisma.property.findFirst({
        where: { id: propertyId, deletedAt: null },
      });

      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: "Property not found" });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const prop = await tx.property.update({
          where: { id: propertyId },
          data: {
            verificationStatus:
              existing.verificationStatus === VerifyStatus.VERIFIED
                ? VerifyStatus.VERIFIED
                : VerifyStatus.PUBLISHED_UNVERIFIED,
            isPublished: true,
            badgeLabel:
              existing.verificationStatus === VerifyStatus.VERIFIED
                ? "PGfy Verified"
                : "PGfy Not Verified",
          },
        });

        await tx.propertyStatusHistory.create({
          data: {
            propertyId,
            changedByUserId: adminId,
            fromStatus: existing.verificationStatus,
            toStatus: prop.verificationStatus,
            reason: "Published listing to tenant discovery portal",
          },
        });

        return prop;
      });

      return res.json({ success: true, data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
