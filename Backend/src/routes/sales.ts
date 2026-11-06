import { EnquiryStatus } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../infrastructure/prisma";
import { AuthenticatedRequest, requireRole } from "../middleware/requireRole";
import { LogFollowupSchema } from "../schemas/enquiry";

const router = Router();

router.post(
  "/api/sales/enquiries/:enquiryId/followups",
  requireRole(["SALES_AGENT", "ADMIN"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const enquiryId = Array.isArray(req.params.enquiryId)
        ? req.params.enquiryId[0]
        : req.params.enquiryId;
      if (!enquiryId) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid enquiry ID" });
      }
      const salesAgentId = req.user!.id;
      const parsed = LogFollowupSchema.parse(req.body);

      const enquiry = await prisma.enquiry.findUnique({
        where: { id: enquiryId },
      });
      if (!enquiry) {
        return res
          .status(404)
          .json({ success: false, error: "Enquiry not found" });
      }

      const result = await prisma.$transaction(async (tx) => {
        const followup = await tx.enquiryFollowup.create({
          data: {
            enquiryId,
            salesAgentId,
            channel: parsed.channel,
            outcomeStatus: parsed.outcomeStatus,
            notes: parsed.notes,
            nextFollowupAt: parsed.nextFollowupAt
              ? new Date(parsed.nextFollowupAt)
              : null,
          },
        });

        const updatedEnquiry = await tx.enquiry.update({
          where: { id: enquiryId },
          data: {
            status:
              (parsed.updatedEnquiryStatus as EnquiryStatus) ||
              EnquiryStatus.IN_FOLLOWUP,
            assignedSalesId: enquiry.assignedSalesId || salesAgentId,
          },
        });

        return { followup, enquiry: updatedEnquiry };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, errors: err.issues });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
