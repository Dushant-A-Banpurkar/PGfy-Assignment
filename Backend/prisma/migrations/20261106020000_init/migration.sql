-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TENANT', 'SALES_AGENT', 'PROPERTY_OWNER');

-- CreateEnum
CREATE TYPE "CategoryProp" AS ENUM ('PG', 'HOSTEL', 'DORMITORY', 'FLAT', 'ROOM');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'VERIFIED', 'PUBLISHED_UNVERIFIED', 'UNDER_VERIFICATION', 'REJECTED', 'HOLD');

-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'PHONE_CALL', 'ON_SITE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'ASSIGNED', 'FOLLOWUP', 'VISIT', 'ENQUIRY_CLOSED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "fullName" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TENANT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" "CategoryProp" NOT NULL,
    "verification_status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(80) NOT NULL DEFAULT 'PGfy Not Verified',
    "city" VARCHAR(120) NOT NULL,
    "locality" VARCHAR(120) NOT NULL,
    "address_line" TEXT NOT NULL,
    "pincode" VARCHAR(12) NOT NULL,
    "rent_min" INTEGER NOT NULL,
    "rent_max" INTEGER NOT NULL,
    "security_deposit" INTEGER NOT NULL DEFAULT 0,
    "owner_contact_name" VARCHAR(120) NOT NULL,
    "owner_contact_phone" VARCHAR(20) NOT NULL,
    "owner_contact_email" VARCHAR(255),
    "normalized_dedup_key" VARCHAR(255) NOT NULL,
    "category_details" JSONB NOT NULL DEFAULT '{}',
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_admin_id" UUID NOT NULL,
    "verified_owner_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryFollowup" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "sales_agent_id" UUID NOT NULL,
    "channel" "FollowUpChannel" NOT NULL,
    "outcome_status" VARCHAR(80) NOT NULL,
    "notes" TEXT NOT NULL,
    "next_followup_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "tenant_user_id" UUID,
    "tenant_name" VARCHAR(120) NOT NULL,
    "tenant_phone" VARCHAR(20) NOT NULL,
    "tenant_email" VARCHAR(255),
    "message" TEXT,
    "preferred_move_in" DATE,
    "occupancy_preference" VARCHAR(80),
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assigned_sales_id" UUID,
    "was_unverified_at_submit" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyVerification" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID NOT NULL,
    "decision" "PropertyStatus" NOT NULL DEFAULT 'UNDER_VERIFICATION',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PropertyVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyStatusHistory" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "changed_by_user_id" UUID NOT NULL,
    "from_status" "PropertyStatus",
    "to_status" "PropertyStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "channel" "NotificationType" NOT NULL,
    "recipient" VARCHAR(180) NOT NULL,
    "provider_message_id" VARCHAR(160),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_is_active_idx" ON "User"("role", "is_active");

-- CreateIndex
CREATE INDEX "Property_is_published_verification_status_created_at_idx" ON "Property"("is_published", "verification_status", "created_at");

-- CreateIndex
CREATE INDEX "Property_city_locality_idx" ON "Property"("city", "locality");

-- CreateIndex
CREATE INDEX "Property_normalized_dedup_key_deleted_at_idx" ON "Property"("normalized_dedup_key", "deleted_at");

-- CreateIndex
CREATE INDEX "EnquiryFollowup_enquiry_id_created_at_idx" ON "EnquiryFollowup"("enquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "EnquiryFollowup_sales_agent_id_created_at_idx" ON "EnquiryFollowup"("sales_agent_id", "created_at");

-- CreateIndex
CREATE INDEX "Enquiry_property_id_tenant_phone_created_at_idx" ON "Enquiry"("property_id", "tenant_phone", "created_at");

-- CreateIndex
CREATE INDEX "Enquiry_assigned_sales_id_status_created_at_idx" ON "Enquiry"("assigned_sales_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "PropertyVerification_property_id_created_at_idx" ON "PropertyVerification"("property_id", "created_at");

-- CreateIndex
CREATE INDEX "PropertyStatusHistory_property_id_created_at_idx" ON "PropertyStatusHistory"("property_id", "created_at");

-- CreateIndex
CREATE INDEX "PropertyMedia_property_id_sort_order_idx" ON "PropertyMedia"("property_id", "sort_order");

-- CreateIndex
CREATE INDEX "NotificationLog_delivery_status_created_at_idx" ON "NotificationLog"("delivery_status", "created_at");

-- CreateIndex
CREATE INDEX "NotificationLog_enquiry_id_channel_idx" ON "NotificationLog"("enquiry_id", "channel");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_verified_owner_id_fkey" FOREIGN KEY ("verified_owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryFollowup" ADD CONSTRAINT "EnquiryFollowup_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryFollowup" ADD CONSTRAINT "EnquiryFollowup_sales_agent_id_fkey" FOREIGN KEY ("sales_agent_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assigned_sales_id_fkey" FOREIGN KEY ("assigned_sales_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVerification" ADD CONSTRAINT "PropertyVerification_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVerification" ADD CONSTRAINT "PropertyVerification_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyStatusHistory" ADD CONSTRAINT "PropertyStatusHistory_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyStatusHistory" ADD CONSTRAINT "PropertyStatusHistory_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
