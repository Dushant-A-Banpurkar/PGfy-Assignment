import { PropertyCategory } from "@prisma/client";
import { z } from "zod";

export const PgHostelDetailsSchema = z.object({
  sharingTypes: z
    .array(z.enum(["SINGLE", "DOUBLE", "TRIPLE", "FOUR_SHARING"]))
    .min(1),
  genderAllowed: z.enum(["BOYS", "GIRLS", "COED"]),
  foodIncluded: z.boolean(),
  mealsOffered: z.array(z.enum(["BREAKFAST", "LUNCH", "DINNER"])).optional(),
  curfewTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable()
    .optional(),
  laundryIncluded: z.boolean().default(false),
  noticePeriodDays: z.number().int().min(0).default(30),
});

export const DormitoryDetailsSchema = z.object({
  totalBeds: z.number().int().positive(),
  availableBeds: z.number().int().min(0),
  bunkType: z.enum(["SINGLE_BED", "DOUBLE_DECKER", "CAPSULE"]),
  genderAllowed: z.enum(["MEN", "WOMEN", "MIXED"]),
  lockerProvided: z.boolean(),
  commonBathroomsCount: z.number().int().min(1),
  dailyStayAvailable: z.boolean().default(false),
});

export const FlatDetailsSchema = z.object({
  bhkConfig: z.enum(["1RK", "1BHK", "2BHK", "3BHK", "4BHK_PLUS"]),
  furnishingStatus: z.enum([
    "UNFURNISHED",
    "SEMI_FURNISHED",
    "FULLY_FURNISHED",
  ]),
  carpetAreaSqFt: z.number().positive(),
  floorNumber: z.number().int().min(0),
  totalFloors: z.number().int().min(1),
  preferredTenants: z.enum(["FAMILY", "BACHELORS", "COMPANY_LEASE", "ANY"]),
  maintenanceMonthly: z.number().int().min(0).default(0),
  parkingAvailable: z.boolean().default(false),
});

export const IndividualRoomDetailsSchema = z.object({
  attachedWashroom: z.boolean(),
  kitchenAccess: z.enum(["NONE", "SHARED_KITCHEN", "PRIVATE_PANTRY"]),
  separateElectricityMeter: z.boolean(),
  maxOccupants: z.number().int().min(1).max(6),
  independentEntry: z.boolean().default(true),
  furnishingStatus: z.enum([
    "UNFURNISHED",
    "SEMI_FURNISHED",
    "FULLY_FURNISHED",
  ]),
});

export const CreateUnverifiedPropertySchema = z
  .object({
    title: z.string().min(5).max(200),
    description: z.string().max(5000).optional(),
    category: z.nativeEnum(PropertyCategory),
    city: z.string().min(2).max(80),
    locality: z.string().min(2).max(120),
    addressLine: z.string().min(5),
    pincode: z
      .string()
      .regex(/^[1-9][0-9]{5}$/, "Invalid 6-digit Indian pincode"),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    rentMin: z.number().int().min(0),
    rentMax: z.number().int().min(0),
    securityDeposit: z.number().int().min(0).default(0),
    ownerContactName: z.string().min(2).max(120),
    ownerContactPhone: z
      .string()
      .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
    ownerContactEmail: z.string().email().optional(),
    amenities: z.array(z.string()).default([]),
    categoryDetails: z.record(z.string(), z.unknown()),
    media: z
      .array(
        z.object({
          mediaUrl: z.string().url(),
          mediaType: z.enum(["IMAGE", "VIDEO", "FLOOR_PLAN"]).default("IMAGE"),
          isPrimary: z.boolean().default(false),
          sortOrder: z.number().int().default(0),
        }),
      )
      .default([]),
    publishImmediately: z.boolean().default(false),
    forceCreateIgnoreDuplicateWarning: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.rentMax < data.rentMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rentMax"],
        message: "rentMax must be greater than or equal to rentMin",
      });
    }

    // Validate categoryDetails JSONB against the specific PropertyCategory schema
    const schemaMap: Record<PropertyCategory, z.ZodTypeAny> = {
      PG_HOSTEL: PgHostelDetailsSchema,
      DORMITORY: DormitoryDetailsSchema,
      FLAT: FlatDetailsSchema,
      INDIVIDUAL_ROOM: IndividualRoomDetailsSchema,
    };

    const result = schemaMap[data.category].safeParse(data.categoryDetails);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          ...issue,
          path: ["categoryDetails", ...issue.path],
        });
      });
    }
  });
