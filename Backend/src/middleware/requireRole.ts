import { NextFunction, Request, Response } from 'express';

export const USER_ROLES = ['ADMIN', 'SALES_AGENT', 'TENANT', 'PROPERTY_OWNER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
  };
}

export function requireRole(allowedRoles: readonly UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires one of [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
}
