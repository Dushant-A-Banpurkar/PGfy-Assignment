import { NotificationType } from '@prisma/client';
import { Queue } from 'bullmq';
import { redisConnection } from '../infrastructure/redis';

export const ENQUIRY_NOTIFICATION_QUEUE = 'enquiry-notifications';

export interface EnquiryNotificationJobPayload {
  task: 'dispatch-channel';
  notificationLogId: string;
  enquiryId: string;
  channel: NotificationType;
  recipient: string;
  propertyId: string;
  propertyTitle: string;
  propertyCategory: string;
  city: string;
  locality: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string | null;
  preferredMoveIn: string | null;
  occupancyPreference: string | null;
}

export interface RecoverNotificationOutboxJob {
  task: 'recover-outbox';
}

export type NotificationQueueJob = EnquiryNotificationJobPayload | RecoverNotificationOutboxJob;

export const enquiryNotificationQueue = new Queue<NotificationQueueJob>(
  ENQUIRY_NOTIFICATION_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: true,
      removeOnFail: 5_000,
    },
  },
);

export async function closeEnquiryNotificationQueue(): Promise<void> {
  await enquiryNotificationQueue.close();
}
