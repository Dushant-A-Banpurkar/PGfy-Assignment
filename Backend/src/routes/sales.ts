import { EnquiryStatus } from '@prisma/client';
import { Response, Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/auth';
import { AuthenticatedRequest, requireRole } from '../middleware/requireRole';
import { LogFollowupSchema } from '../schemas/enquiry';
import prisma from '../utils/prisma';

const router = Router();

router.get(
  '/api/sales/enquiries',
  authenticate,
  requireRole(['SALES_AGENT', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const query = z
      .object({
        status: z
          .enum(['NEW', 'ASSIGNED', 'FOLLOWUP', 'VISIT', 'ENQUIRY_CLOSED'])
          .optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
      })
      .safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ success: false, errors: query.error.issues });
    }

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const where = {
      ...(query.data.status ? { status: query.data.status } : {}),
      ...(req.user?.role === 'SALES_AGENT'
        ? { OR: [{ assignedSalesId: userId }, { assignedSalesId: null }] }
        : {}),
    };
    const skip = (query.data.page - 1) * query.data.limit;

    try {
      const [total, enquiries] = await Promise.all([
        prisma.enquiry.count({ where }),
        prisma.enquiry.findMany({
          where,
          include: {
            property: {
              select: { id: true, name: true, city: true, locality: true, verificationStatus: true },
            },
            followups: { orderBy: { createdAt: 'desc' }, take: 1 },
            notifications: { select: { channel: true, deliveryStatus: true, errorMessage: true } },
          },
          orderBy: { createdAt: 'asc' },
          skip,
          take: query.data.limit,
        }),
      ]);

      return res.json({
        success: true,
        pagination: {
          total,
          page: query.data.page,
          limit: query.data.limit,
          totalPages: Math.ceil(total / query.data.limit),
        },
        data: enquiries,
      });
    } catch (error) {
      console.error('Failed to retrieve sales enquiries:', error);
      return res.status(500).json({ success: false, error: 'Failed to retrieve enquiries' });
    }
  },
);

router.post(
  '/api/sales/enquiries/:enquiryId/claim',
  authenticate,
  requireRole(['SALES_AGENT']),
  async (req: AuthenticatedRequest, res: Response) => {
    const enquiryId = z.uuid().safeParse(req.params.enquiryId);
    if (!enquiryId.success) {
      return res.status(400).json({ success: false, error: 'Invalid enquiry ID' });
    }
    const salesAgentId = req.user?.id;
    if (!salesAgentId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
      const changed = await prisma.enquiry.updateMany({
        where: {
          id: enquiryId.data,
          assignedSalesId: null,
          status: { not: EnquiryStatus.ENQUIRY_CLOSED },
        },
        data: { assignedSalesId: salesAgentId, status: EnquiryStatus.ASSIGNED },
      });
      if (changed.count === 0) {
        const current = await prisma.enquiry.findUnique({
          where: { id: enquiryId.data },
          select: { id: true, assignedSalesId: true, status: true },
        });
        if (!current) {
          return res.status(404).json({ success: false, error: 'Enquiry not found' });
        }
        if (current.assignedSalesId !== salesAgentId) {
          return res.status(409).json({ success: false, error: 'Enquiry is already assigned or closed' });
        }
      }

      const enquiry = await prisma.enquiry.findUnique({ where: { id: enquiryId.data } });
      return res.json({ success: true, data: enquiry });
    } catch (error) {
      console.error('Failed to claim sales enquiry:', error);
      return res.status(500).json({ success: false, error: 'Failed to claim enquiry' });
    }
  },
);

router.post(
  '/api/sales/enquiries/:enquiryId/followups',
  authenticate,
  requireRole(['SALES_AGENT']),
  async (req: AuthenticatedRequest, res: Response) => {
    const enquiryId = z.uuid().safeParse(req.params.enquiryId);
    if (!enquiryId.success) {
      return res.status(400).json({ success: false, error: 'Invalid enquiry ID' });
    }

    const salesAgentId = req.user?.id;
    if (!salesAgentId || !z.uuid().safeParse(salesAgentId).success) {
      return res.status(401).json({ success: false, error: 'Authenticated user ID is invalid' });
    }

    const parsedBody = LogFollowupSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, errors: parsedBody.error.issues });
    }
    const parsed = parsedBody.data;

    try {
      let enquiry = await prisma.enquiry.findUnique({
        where: { id: enquiryId.data },
        select: { id: true, assignedSalesId: true },
      });
      if (!enquiry) {
        return res.status(404).json({ success: false, error: 'Enquiry not found' });
      }

      if (enquiry.assignedSalesId && enquiry.assignedSalesId !== salesAgentId) {
        return res.status(403).json({
          success: false,
          error: 'This enquiry is assigned to another sales agent',
        });
      }

      if (!enquiry.assignedSalesId) {
        const claimed = await prisma.enquiry.updateMany({
          where: {
            id: enquiry.id,
            assignedSalesId: null,
            status: { not: EnquiryStatus.ENQUIRY_CLOSED },
          },
          data: { assignedSalesId: salesAgentId, status: EnquiryStatus.ASSIGNED },
        });
        if (claimed.count === 0) {
          enquiry = await prisma.enquiry.findUnique({
            where: { id: enquiryId.data },
            select: { id: true, assignedSalesId: true },
          });
          if (!enquiry) {
            return res.status(404).json({ success: false, error: 'Enquiry not found' });
          }
          if (enquiry.assignedSalesId !== salesAgentId) {
            return res.status(409).json({
              success: false,
              error: 'Another sales agent claimed this enquiry first',
            });
          }
        }
      }

      const nextStatus = parsed.updatedEnquiryStatus ?? EnquiryStatus.FOLLOWUP;
      const result = await prisma.$transaction(async (tx) => {
        const followup = await tx.enquiryFollowup.create({
          data: {
            enquiryId: enquiry.id,
            salesAgentId,
            channel: parsed.channel,
            outcomeStatus: parsed.outcomeStatus,
            notes: parsed.notes,
            nextFollowupAt: parsed.nextFollowupAt ? new Date(parsed.nextFollowupAt) : null,
          },
        });

        const updatedEnquiry = await tx.enquiry.update({
          where: { id: enquiry.id },
          data: {
            status: nextStatus,
            assignedSalesId: salesAgentId,
          },
        });

        return { followup, enquiry: updatedEnquiry };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('Failed to record sales follow-up:', error);
      return res.status(500).json({ success: false, error: 'Failed to record follow-up' });
    }
  },
);

export default router;
