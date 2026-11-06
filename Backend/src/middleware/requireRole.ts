import { NextFunction, Request, Response } from "express";
import { authenticate } from "../auth/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: "ADMIN" | "SALES_AGENT" | "TENANT" | "PROPERTY_OWNER";
    email: string;
  };
}

export type UserRole = NonNullable<AuthenticatedRequest["user"]>["role"];

export function requireRole(allowedRoles: readonly UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    authenticate(req, res, () => {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, error: "Authentication required" });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: `Forbidden: Requires one of [${allowedRoles.join(", ")}]`,
        });
        return;
      }

      next();
    });
  };
}
