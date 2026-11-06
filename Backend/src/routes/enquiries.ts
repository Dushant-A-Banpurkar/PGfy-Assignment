import { DeliveryStatus, EnquiryStatus, NotificationType, PropertyStatus } from '@prisma/client';
import { Response, Router } from 'express';
import { z } from 'zod';
import { optionalAuthenticate } from '../auth/auth';
import { AuthenticatedRequest } from '../middleware/requireRole';
import { enquiryNotificationQueue } from '../queues/enquiryNotifications';
import { SubmitEnquirySchema } from '../schemas/enquiry';
import prisma from '../utils/prisma';

const router = Router();

router.post('/api/enquiries', optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parsedBody = SubmitEnquirySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ success: false, errors: parsedBody.error.issues });
  }
  const parsed = parsedBody.data;

  if (req.user && req.user.role !== 'TENANT') {
    return res.status(403).json({ success: false, error: 'Only tenant accounts can submit enquiries' });
  }

  if (req.user && !z.uuid().safeParse(req.user.id).success) {
    return res.status(401).json({ success: false, error: 'Authenticated user ID is invalid' });
  }

  try {
    const property = await prisma.property.findFirst({
      where: {
        id: parsed.propertyId,
        isPublished: true,
        deletedAt: null,
        verificationStatus: {
          in: [PropertyStatus.PUBLISHED_UNVERIFIED, PropertyStatus.UNDER_VERIFICATION],
        },
      },
      select: {
        id: true,
        name: true,
        category: true,
        city: true,
        locality: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Unverified property is not available for enquiries',
      });
    }

    const recentEnquiry = await prisma.enquiry.findFirst({
      where: {
        propertyId: property.id,
        tenantPhone: parsed.tenantPhone,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentEnquiry) {
      return res.status(200).json({
        success: true,
        duplicateThrottled: true,
        message: 'We already received your enquiry for this property today.',
        data: recentEnquiry,
      });
    }

    const salesAgent = await prisma.user.findFirst({
      where: { role: 'SALES_AGENT', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, phone: true, email: true },
    });
    const salesPhone = salesAgent?.phone || process.env.SALES_TEAM_WHATSAPP;
    const salesEmail = salesAgent?.email || process.env.SALES_TEAM_EMAIL;

    if (!salesPhone || !salesEmail) {
      return res.status(503).json({
        success: false,
        error:
          'Sales notification recipients are not configured. Set SALES_TEAM_WHATSAPP and SALES_TEAM_EMAIL or add an active sales agent with both contacts.',
      });
    }

    const { enquiry, whatsappLog, emailLog } = await prisma.$transaction(async (tx) => {
      const created = await tx.enquiry.create({
        data: {
          propertyId: property.id,
          tenantUserId: req.user?.id,
          tenantName: parsed.tenantName,
          tenantPhone: parsed.tenantPhone,
          tenantEmail: parsed.tenantEmail,
          message: parsed.message,
          preferredMoveIn: parsed.preferredMoveIn
            ? new Date(`${parsed.preferredMoveIn}T00:00:00.000Z`)
            : null,
          occupancyPreference: parsed.occupancyPreference,
          status: salesAgent ? EnquiryStatus.ASSIGNED : EnquiryStatus.NEW,
          assignedSalesId: salesAgent?.id,
          wasUnverifiedAtSubmit: true,
        },
      });

      const logs = await Promise.all([
        tx.notificationLog.create({
          data: {
            enquiryId: created.id,
            channel: NotificationType.WHATSAPP,
            recipient: salesPhone,
            deliveryStatus: DeliveryStatus.QUEUED,
          },
        }),
        tx.notificationLog.create({
          data: {
            enquiryId: created.id,
            channel: NotificationType.EMAIL,
            recipient: salesEmail,
            deliveryStatus: DeliveryStatus.QUEUED,
          },
        }),
      ]);

      return { enquiry: created, whatsappLog: logs[0], emailLog: logs[1] };
    });

    const jobDetails = {
      enquiryId: enquiry.id,
      propertyId: property.id,
      propertyTitle: property.name,
      propertyCategory: property.category,
      city: property.city,
      locality: property.locality,
      tenantName: enquiry.tenantName,
      tenantPhone: enquiry.tenantPhone,
      tenantEmail: enquiry.tenantEmail,
      preferredMoveIn: parsed.preferredMoveIn ?? null,
      occupancyPreference: enquiry.occupancyPreference,
    };
    const enqueueResults = await Promise.allSettled([
      enquiryNotificationQueue.add(
        'dispatch-channel',
        {
          ...jobDetails,
          task: 'dispatch-channel',
          channel: NotificationType.WHATSAPP,
          recipient: whatsappLog.recipient,
          notificationLogId: whatsappLog.id,
        },
        { jobId: `notification-${whatsappLog.id}` },
      ),
      enquiryNotificationQueue.add(
        'dispatch-channel',
        {
          ...jobDetails,
          task: 'dispatch-channel',
          channel: NotificationType.EMAIL,
          recipient: emailLog.recipient,
          notificationLogId: emailLog.id,
        },
        { jobId: `notification-${emailLog.id}` },
      ),
    ]);
    const queuedCount = enqueueResults.filter((result) => result.status === 'fulfilled').length;
    for (const result of enqueueResults) {
      if (result.status === 'rejected') {
        console.error('Notification job enqueue failed; outbox recovery will retry:', result.reason);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Enquiry recorded. Notification delivery will be processed asynchronously.',
      notifications: { queued: queuedCount, total: 2 },
      data: enquiry,
    });
  } catch (error) {
    console.error('Failed to submit enquiry:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit enquiry' });
  }
});

export default router;
