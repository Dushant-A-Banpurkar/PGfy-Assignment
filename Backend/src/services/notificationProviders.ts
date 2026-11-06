import "dotenv/config";
import nodemailer from "nodemailer";
import { NotifyChannel } from "@prisma/client";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export interface SendNotificationInput {
  channel: NotifyChannel;
  recipient: string;
  enquiryId: string;
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function sendWhatsApp(input: SendNotificationInput): Promise<string> {
  const token = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
  const templateName = requiredEnv("WHATSAPP_TEMPLATE_NAME");
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v22.0";

  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new Error("WHATSAPP_GRAPH_API_VERSION must look like v22.0");
  }

  const parameters = [
    input.propertyTitle,
    input.propertyCategory,
    `${input.locality}, ${input.city}`,
    input.tenantName,
    input.tenantPhone,
    input.preferredMoveIn || "Flexible",
    input.occupancyPreference || "Any",
    input.enquiryId,
  ];

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.recipient.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: parameters.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  const result = (await response.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        `WhatsApp provider returned HTTP ${response.status}`,
    );
  }
  const messageId = result?.messages?.[0]?.id;
  if (!messageId)
    throw new Error("WhatsApp provider response did not contain a message ID");
  return messageId;
}

async function sendEmail(input: SendNotificationInput): Promise<string> {
  const host = requiredEnv("SMTP_HOST");
  const port = Number(requiredEnv("SMTP_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535");
  }

  const user = requiredEnv("SMTP_USER");
  const password = requiredEnv("SMTP_PASSWORD");
  const from = requiredEnv("SMTP_FROM");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    requireTLS: port !== 465,
    auth: { user, pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  const subject = `[PGfy Lead] ${input.tenantName} enquired about ${input.propertyTitle}`;
  const text = [
    "New tenant enquiry on an unverified property",
    `Property: ${input.propertyTitle} (${input.propertyCategory})`,
    `Location: ${input.locality}, ${input.city}`,
    `Tenant: ${input.tenantName}`,
    `Phone: ${input.tenantPhone}`,
    `Email: ${input.tenantEmail || "Not provided"}`,
    `Preferred move-in: ${input.preferredMoveIn || "Not specified"}`,
    `Occupancy: ${input.occupancyPreference || "Not specified"}`,
    `Enquiry ID: ${input.enquiryId}`,
  ].join("\n");
  const html = `<h3>New tenant enquiry on an unverified property</h3><dl>
    <dt>Property</dt><dd>${escapeHtml(input.propertyTitle)} (${escapeHtml(input.propertyCategory)})</dd>
    <dt>Location</dt><dd>${escapeHtml(input.locality)}, ${escapeHtml(input.city)}</dd>
    <dt>Tenant</dt><dd>${escapeHtml(input.tenantName)}</dd>
    <dt>Phone</dt><dd>${escapeHtml(input.tenantPhone)}</dd>
    <dt>Email</dt><dd>${escapeHtml(input.tenantEmail || "Not provided")}</dd>
    <dt>Preferred move-in</dt><dd>${escapeHtml(input.preferredMoveIn || "Not specified")}</dd>
    <dt>Occupancy</dt><dd>${escapeHtml(input.occupancyPreference || "Not specified")}</dd>
    <dt>Enquiry ID</dt><dd>${escapeHtml(input.enquiryId)}</dd>
  </dl>`;

  try {
    const result = await transporter.sendMail({
      from,
      to: input.recipient,
      subject,
      text,
      html,
    });
    if (!result.messageId)
      throw new Error("SMTP provider response did not contain a message ID");
    return result.messageId;
  } finally {
    transporter.close();
  }
}

export async function sendNotification(
  input: SendNotificationInput,
): Promise<string> {
  if (input.channel === NotifyChannel.WHATSAPP) return sendWhatsApp(input);
  if (input.channel === NotifyChannel.EMAIL) return sendEmail(input);
  throw new Error(`Unsupported notification channel: ${input.channel}`);
}
