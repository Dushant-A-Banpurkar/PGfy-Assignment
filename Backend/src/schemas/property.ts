import { z } from 'zod';

const categoryDetailsSchema = z.record(z.string(), z.json()).optional();

export const CreateUnverifiedPropertySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(10000).optional(),
    category: z.enum(['PG', 'HOSTEL', 'DORMITORY', 'FLAT', 'ROOM']),
    city: z.string().trim().min(1).max(120),
    locality: z.string().trim().min(1).max(120),
    addressLine: z.string().trim().min(1),
    pincode: z.string().trim().min(4).max(12),
    rentMin: z.number().int().nonnegative(),
    rentMax: z.number().int().nonnegative(),
    securityDeposit: z.number().int().nonnegative().default(0),
    ownerContactName: z.string().trim().min(1).max(120),
    ownerContactPhone: z.string().trim().min(7).max(20),
    ownerContactEmail: z.email().optional(),
    categoryDetails: categoryDetailsSchema,
    amenities: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
    media: z
      .array(
        z.object({
          mediaUrl: z.url(),
          mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
          isPrimary: z.boolean().default(false),
          sortOrder: z.number().int().nonnegative().default(0),
        }),
      )
      .max(30)
      .default([]),
    publishImmediately: z.boolean().default(false),
    forceCreateIgnoreDuplicateWarning: z.boolean().default(false),
  })
  .refine((value) => value.rentMax >= value.rentMin, {
    message: 'rentMax must be greater than or equal to rentMin',
    path: ['rentMax'],
  });

export const UpdatePropertySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    category: z.enum(['PG', 'HOSTEL', 'DORMITORY', 'FLAT', 'ROOM']).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    locality: z.string().trim().min(1).max(120).optional(),
    addressLine: z.string().trim().min(1).optional(),
    pincode: z.string().trim().min(4).max(12).optional(),
    rentMin: z.number().int().nonnegative().optional(),
    rentMax: z.number().int().nonnegative().optional(),
    securityDeposit: z.number().int().nonnegative().optional(),
    ownerContactName: z.string().trim().min(1).max(120).optional(),
    ownerContactPhone: z.string().trim().min(7).max(20).optional(),
    ownerContactEmail: z.email().nullable().optional(),
    categoryDetails: categoryDetailsSchema,
    amenities: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one property field must be provided',
  });

export const PropertyListQuerySchema = z.object({
  city: z.string().trim().min(1).optional(),
  locality: z.string().trim().min(1).optional(),
  category: z.enum(['PG', 'HOSTEL', 'DORMITORY', 'FLAT', 'ROOM']).optional(),
  minRent: z.coerce.number().int().nonnegative().optional(),
  maxRent: z.coerce.number().int().nonnegative().optional(),
  verificationFilter: z.enum(['ALL', 'VERIFIED_ONLY', 'UNVERIFIED_ONLY']).default('ALL'),
  foodIncluded: z.enum(['true', 'false']).optional(),
  bhkConfig: z.string().trim().min(1).max(40).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});
