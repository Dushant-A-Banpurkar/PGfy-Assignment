import { PropertyCategory, VerifyStatus } from "@prisma/client";
import { Request, Response, Router } from "express";
import { prisma } from "../infrastructure/prisma";

const router = Router();

router.get("/api/properties", async (req: Request, res: Response) => {
  try {
    const {
      city,
      locality,
      category,
      minRent,
      maxRent,
      verificationFilter,
      foodIncluded,
      bhkConfig,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {
      isPublished: true,
      deletedAt: null,
    };

    if (city) whereClause.city = { equals: String(city), mode: "insensitive" };
    if (locality)
      whereClause.locality = { equals: String(locality), mode: "insensitive" };
    if (category) whereClause.category = String(category) as PropertyCategory;
    if (minRent) whereClause.rentMax = { gte: Number(minRent) };
    if (maxRent) whereClause.rentMin = { lte: Number(maxRent) };

    if (verificationFilter === "VERIFIED_ONLY") {
      whereClause.verificationStatus = VerifyStatus.VERIFIED;
    } else if (verificationFilter === "UNVERIFIED_ONLY") {
      whereClause.verificationStatus = {
        in: [
          VerifyStatus.PUBLISHED_UNVERIFIED,
          VerifyStatus.UNDER_VERIFICATION,
        ],
      };
    }

    const jsonbFilter: Record<string, any> = {};
    if (foodIncluded !== undefined)
      jsonbFilter.foodIncluded = foodIncluded === "true";
    if (bhkConfig) jsonbFilter.bhkConfig = String(bhkConfig);
    if (Object.keys(jsonbFilter).length > 0) {
      whereClause.categoryDetails = { contains: jsonbFilter };
    }

    const [total, properties] = await Promise.all([
      prisma.property.count({ where: whereClause }),
      prisma.property.findMany({
        where: whereClause,
        include: {
          media: { orderBy: { sortOrder: "asc" }, take: 5 },
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take,
      }),
    ]);

    const items = properties.map((p) => {
      const isVerified = p.verificationStatus === VerifyStatus.VERIFIED;
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        category: p.category,
        city: p.city,
        locality: p.locality,
        rentMin: p.rentMin,
        rentMax: p.rentMax,
        securityDeposit: p.securityDeposit,
        isVerified,
        verificationStatus: p.verificationStatus,
        badgeLabel: isVerified ? "PGfy Verified" : "PGfy Not Verified",
        categoryDetails: p.categoryDetails,
        amenities: p.amenities,
        media: p.media,
      };
    });

    return res.json({
      success: true,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      data: items,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
