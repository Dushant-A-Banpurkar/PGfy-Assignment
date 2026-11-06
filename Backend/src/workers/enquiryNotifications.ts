import { DeliveryStatus, NotifyChannel } from "@prisma/client";
import { Job, Worker } from "bullmq";
import { prisma } from "../infrastructure/prisma";
import { redisConnection } from "../infrastructure/redis";
import {
  closeEnquiryNotificationQueue,
  ENQUIRY_NOTIFICATION_QUEUE,
  EnquiryNotificationJobPayload,
} from "../queues/enquiryNotifications";
import { sendNotification } from "../services/notificationProviders";

async function dispatchChannel(
  job: Job<EnquiryNotificationJobPayload>,
  channel: NotifyChannel,
  logId: string,
  recipient: string,
): Promise<void> {
  const existingLog = await prisma.notificationLog.findUnique({
    where: { id: logId },
    select: { deliveryStatus: true },
  });
  if (existingLog?.deliveryStatus === DeliveryStatus.SENT) return;

  const data = job.data;
  try {
    const providerMessageId = await sendNotification({
      channel,
      recipient,
      enquiryId: data.enquiryId,
      propertyTitle: data.propertyTitle,
      propertyCategory: data.propertyCategory,
      city: data.city,
      locality: data.locality,
      tenantName: data.tenantName,
      tenantPhone: data.tenantPhone,
      tenantEmail: data.tenantEmail ?? null,
      preferredMoveIn: data.preferredMoveIn ?? null,
      occupancyPreference: data.occupancyPreference ?? null,
    });

    await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        deliveryStatus: DeliveryStatus.SENT,
        providerMessageId,
        sentAt: new Date(),
        retryCount: job.attemptsMade,
        errorMessage: null,
      },
    });
  } catch (error: unknown) {
    const attempts =
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
    const willRetry = job.attemptsMade + 1 < attempts;
    await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        deliveryStatus: willRetry
          ? DeliveryStatus.QUEUED
          : DeliveryStatus.FAILED,
        retryCount: job.attemptsMade + 1,
        errorMessage: (error instanceof Error
          ? error.message
          : "Notification delivery failed"
        ).slice(0, 2000),
      },
    });
    throw error;
  }
}

export const enquiryNotificationWorker =
  new Worker<EnquiryNotificationJobPayload>(
    ENQUIRY_NOTIFICATION_QUEUE,
    async (job) => {
      const data = job.data;
      await dispatchChannel(
        job,
        NotifyChannel.WHATSAPP,
        data.whatsappLogId,
        data.salesRecipientPhone,
      );
      await dispatchChannel(
        job,
        NotifyChannel.EMAIL,
        data.emailLogId,
        data.salesRecipientEmail,
      );
    },
    { connection: redisConnection, concurrency: 10 },
  );

enquiryNotificationWorker.on("error", (error) => {
  console.error("Notification worker error:", error);
});

export async function startEnquiryNotificationWorker(): Promise<void> {
  await redisConnection.ping();
  await prisma.$connect();
}

export async function stopEnquiryNotificationWorker(): Promise<void> {
  await enquiryNotificationWorker.close();
  await closeEnquiryNotificationQueue();
  await redisConnection.quit();
  await prisma.$disconnect();
}
