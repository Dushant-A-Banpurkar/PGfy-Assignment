import { DeliveryStatus } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import { redisConnection } from '../infrastructure/redis';
import prisma from '../utils/prisma';
import {
  closeEnquiryNotificationQueue,
  ENQUIRY_NOTIFICATION_QUEUE,
  EnquiryNotificationJobPayload,
  enquiryNotificationQueue,
  NotificationQueueJob,
} from '../queues/enquiryNotifications';
import { sendNotification } from '../services/notificationProviders';

async function recoverQueuedNotifications(): Promise<void> {
  const pending = await prisma.notificationLog.findMany({
    where: { deliveryStatus: DeliveryStatus.QUEUED },
    include: {
      enquiry: {
        include: {
          property: {
            select: { id: true, name: true, category: true, city: true, locality: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  for (const log of pending) {
    const enquiry = log.enquiry;
    const property = enquiry.property;
    const payload: EnquiryNotificationJobPayload = {
      task: 'dispatch-channel',
      notificationLogId: log.id,
      enquiryId: enquiry.id,
      channel: log.channel,
      recipient: log.recipient,
      propertyId: property.id,
      propertyTitle: property.name,
      propertyCategory: property.category,
      city: property.city,
      locality: property.locality,
      tenantName: enquiry.tenantName,
      tenantPhone: enquiry.tenantPhone,
      tenantEmail: enquiry.tenantEmail,
      preferredMoveIn: enquiry.preferredMoveIn?.toISOString().slice(0, 10) ?? null,
      occupancyPreference: enquiry.occupancyPreference,
    };

    await enquiryNotificationQueue.add('dispatch-channel', payload, {
      jobId: `notification-${log.id}`,
    });
  }
}

export const enquiryNotificationWorker = new Worker<NotificationQueueJob>(
  ENQUIRY_NOTIFICATION_QUEUE,
  async (job: Job<NotificationQueueJob>) => {
    if (job.data.task === 'recover-outbox') {
      await recoverQueuedNotifications();
      return;
    }

    const notification = job.data;
    if (notification.task !== 'dispatch-channel') {
      throw new Error('Unsupported notification queue task');
    }
    try {
      const providerMessageId = await sendNotification({
        channel: notification.channel,
        recipient: notification.recipient,
        enquiryId: notification.enquiryId,
        propertyTitle: notification.propertyTitle,
        propertyCategory: notification.propertyCategory,
        city: notification.city,
        locality: notification.locality,
        tenantName: notification.tenantName,
        tenantPhone: notification.tenantPhone,
        tenantEmail: notification.tenantEmail,
        preferredMoveIn: notification.preferredMoveIn,
        occupancyPreference: notification.occupancyPreference,
      });

      await prisma.notificationLog.update({
        where: { id: notification.notificationLogId },
        data: {
          deliveryStatus: DeliveryStatus.SENT,
          providerMessageId,
          sentAt: new Date(),
          retryCount: job.attemptsMade,
          errorMessage: null,
        },
      });
    } catch (error: unknown) {
      const attempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
      const willRetry = job.attemptsMade + 1 < attempts;
      const errorMessage = (error instanceof Error ? error.message : 'Notification delivery failed')
        .slice(0, 2000);

      await prisma.notificationLog.update({
        where: { id: notification.notificationLogId },
        data: {
          deliveryStatus: willRetry ? DeliveryStatus.QUEUED : DeliveryStatus.FAILED,
          retryCount: job.attemptsMade + 1,
          errorMessage,
        },
      });
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 10 },
);

enquiryNotificationWorker.on('error', (error) => {
  console.error('Notification worker error:', error);
});

export async function startEnquiryNotificationWorker(): Promise<void> {
  await redisConnection.ping();
  await prisma.$connect();
  await enquiryNotificationQueue.upsertJobScheduler(
    'recover-queued-notifications',
    { every: 30_000 },
    { name: 'recover-outbox', data: { task: 'recover-outbox' } },
  );
}

export async function stopEnquiryNotificationWorker(): Promise<void> {
  await enquiryNotificationWorker.close();
  await closeEnquiryNotificationQueue();
  await redisConnection.quit();
  await prisma.$disconnect();
}
