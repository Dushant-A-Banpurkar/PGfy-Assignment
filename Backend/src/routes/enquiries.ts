import {
  DeliveryStatus,
  EnquiryStatus,
  NotifyChannel,
  VerifyStatus,
} from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../infrastructure/prisma";
import { enquiryNotificationQueue } from "../queues/enquiryNotifications";
import { SubmitEnquirySchema } from "../schemas/enquiry";
import { AuthenticatedRequest } from "../middleware/requireRole";
import { optionalAuthenticate } from "../auth/auth";

const router = Router();

router.post(
  "/api/enquiries",
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = SubmitEnquirySchema.parse(req.body);
      const tenantUserId = req.user?.id || null;

      const property = await prisma.property.findFirst({
        where: {
          id: parsed.propertyId,
          isPublished: true,
          deletedAt: null,
        },
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          error: "Property is not available or no longer accepting enquiries.",
        });
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentEnquiry = await prisma.enquiry.findFirst({
        where: {
          propertyId: parsed.propertyId,
          tenantPhone: parsed.tenantPhone,
          createdAt: { gte: twentyFourHoursAgo },
        },
      });

      if (recentEnquiry) {
        return res.status(200).json({
          success: true,
          duplicateThrottled: true,
          message:
            "We already received your enquiry for this property today. Our sales team will reach out shortly.",
          data: recentEnquiry,
        });
      }

      const salesAgent = await prisma.user.findFirst({
        where: { role: "SALES_AGENT", isActive: true },
        orderBy: { createdAt: "asc" },
      });

      const salesPhone =
        salesAgent?.phone || process.env.SALES_TEAM_WHATSAPP || "+919999999999";
      const salesEmail =
        salesAgent?.email || process.env.SALES_TEAM_EMAIL || "sales@pgfy.in";
      const wasUnverified =
        property.verificationStatus !== VerifyStatus.VERIFIED;

      const { enquiry, waLog, emailLog } = await prisma.$transaction(
        async (tx) => {
          const createdEnquiry = await tx.enquiry.create({
            data: {
              propertyId: property.id,
              tenantUserId,
              tenantName: parsed.tenantName,
              tenantPhone: parsed.tenantPhone,
              tenantEmail: parsed.tenantEmail,
              message: parsed.message,
              preferredMoveIn: parsed.preferredMoveIn
                ? new Date(parsed.preferredMoveIn)
                : null,
              occupancyPreference: parsed.occupancyPreference,
              status: salesAgent ? EnquiryStatus.ASSIGNED : EnquiryStatus.NEW,
              assignedSalesId: salesAgent?.id || null,
              wasUnverifiedAtSubmit: wasUnverified,
            },
          });

          const createdWaLog = await tx.notificationLog.create({
            data: {
              enquiryId: createdEnquiry.id,
              channel: NotifyChannel.WHATSAPP,
              recipient: salesPhone,
              deliveryStatus: DeliveryStatus.QUEUED,
            },
          });

          const createdEmailLog = await tx.notificationLog.create({
            data: {
              enquiryId: createdEnquiry.id,
              channel: NotifyChannel.EMAIL,
              recipient: salesEmail,
              deliveryStatus: DeliveryStatus.QUEUED,
            },
          });

          return {
            enquiry: createdEnquiry,
            waLog: createdWaLog,
            emailLog: createdEmailLog,
          };
        },
      );

      await enquiryNotificationQueue.add("dispatch-sales-alerts", {
        enquiryId: enquiry.id,
        propertyId: property.id,
        propertyTitle: property.title,
        propertyCategory: property.category,
        city: property.city,
        locality: property.locality,
        tenantName: enquiry.tenantName,
        tenantPhone: enquiry.tenantPhone,
        tenantEmail: enquiry.tenantEmail,
        preferredMoveIn: parsed.preferredMoveIn || null,
        occupancyPreference: enquiry.occupancyPreference,
        salesRecipientPhone: salesPhone,
        salesRecipientEmail: salesEmail,
        whatsappLogId: waLog.id,
        emailLogId: emailLog.id,
      });

      return res.status(201).json({
        success: true,
        message:
          "Enquiry submitted. Our team has been notified via WhatsApp and Email.",
        data: enquiry,
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
