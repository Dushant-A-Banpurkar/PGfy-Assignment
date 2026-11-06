import { Prisma, PropertyStatus } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { PropertyListQuerySchema } from '../schemas/property';
import prisma from '../utils/prisma';

const router = Router();

router.get('/api/properties', async (req: Request, res: Response) => {
  const parsedQuery = PropertyListQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ success: false, errors: parsedQuery.error.issues });
  }

  const query = parsedQuery.data;
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.PropertyWhereInput = {
    isPublished: true,
    deletedAt: null,
    verificationStatus: {
      in: [
        PropertyStatus.VERIFIED,
        PropertyStatus.PUBLISHED_UNVERIFIED,
        PropertyStatus.UNDER_VERIFICATION,
      ],
    },
  };

  if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
  if (query.locality) where.locality = { equals: query.locality, mode: 'insensitive' };
  if (query.category) where.category = query.category;
  if (query.minRent !== undefined || query.maxRent !== undefined) {
    where.rentMin = query.maxRent === undefined ? undefined : { lte: query.maxRent };
    where.rentMax = query.minRent === undefined ? undefined : { gte: query.minRent };
  }
  if (query.verificationFilter === 'VERIFIED_ONLY') {
    where.verificationStatus = PropertyStatus.VERIFIED;
  } else if (query.verificationFilter === 'UNVERIFIED_ONLY') {
    where.verificationStatus = {
      in: [PropertyStatus.PUBLISHED_UNVERIFIED, PropertyStatus.UNDER_VERIFICATION],
    };
  }

  const jsonFilters: Prisma.PropertyWhereInput[] = [];
  if (query.foodIncluded !== undefined) {
    jsonFilters.push({
      categoryDetails: {
        path: ['foodIncluded'],
        equals: query.foodIncluded === 'true',
      },
    });
  }
  if (query.bhkConfig) {
    jsonFilters.push({
      categoryDetails: {
        path: ['bhkConfig'],
        equals: query.bhkConfig,
      },
    });
  }
  if (jsonFilters.length) where.AND = jsonFilters;

  try {
    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          verificationStatus: true,
          label: true,
          city: true,
          locality: true,
          pincode: true,
          rentMin: true,
          rentMax: true,
          securityDeposit: true,
          categoryDetails: true,
          amenities: true,
          createdAt: true,
          media: {
            orderBy: { sortOrder: 'asc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    const data = properties.map((property) => ({
      ...property,
      isVerified: property.verificationStatus === PropertyStatus.VERIFIED,
      badgeLabel:
        property.verificationStatus === PropertyStatus.VERIFIED
          ? 'PGfy Verified'
          : 'PGfy Not Verified',
    }));

    return res.json({
      success: true,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
      data,
    });
  } catch (error) {
    console.error('Failed to list properties:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve properties' });
  }
});

router.get('/api/properties/:id', async (req: Request, res: Response) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    return res.status(400).json({ success: false, error: 'Invalid property ID' });
  }

  try {
    const property = await prisma.property.findFirst({
      where: {
        id: id.data,
        isPublished: true,
        deletedAt: null,
        verificationStatus: {
          in: [
            PropertyStatus.VERIFIED,
            PropertyStatus.PUBLISHED_UNVERIFIED,
            PropertyStatus.UNDER_VERIFICATION,
          ],
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        verificationStatus: true,
        city: true,
        locality: true,
        pincode: true,
        rentMin: true,
        rentMax: true,
        securityDeposit: true,
        categoryDetails: true,
        amenities: true,
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const isVerified = property.verificationStatus === PropertyStatus.VERIFIED;
    return res.json({
      success: true,
      data: {
        ...property,
        isVerified,
        badgeLabel: isVerified ? 'PGfy Verified' : 'PGfy Not Verified',
      },
    });
  } catch (error) {
    console.error('Failed to retrieve property:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve property' });
  }
});

export default router;
