import { PropertyCategory } from "@prisma/client";
import { Queue } from "bullmq";
import { redisConnection } from "../infrastructure/redis";

export const ENQUIRY_NOTIFICATION_QUEUE = "enquiry-notifications";

export interface EnquiryNotificationJobPayload {
  enquiryId: string;
  propertyId: string;
  propertyTitle: string;
  propertyCategory: PropertyCategory;
  city: string;
  locality: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string | null;
  preferredMoveIn?: string | null;
  occupancyPreference?: string | null;
  salesRecipientPhone: string;
  salesRecipientEmail: string;
  whatsappLogId: string;
  emailLogId: string;
}

export const enquiryNotificationQueue =
  new Queue<EnquiryNotificationJobPayload>(ENQUIRY_NOTIFICATION_QUEUE, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

export async function closeEnquiryNotificationQueue(): Promise<void> {
  await enquiryNotificationQueue.close();
}
