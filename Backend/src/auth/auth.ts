import { createHmac, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma";
import type { AuthenticatedRequest } from "../middleware/requireRole";

interface TokenClaims {
  sub: string;
  exp: number;
  nbf?: number;
}

function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed token");
  return Buffer.from(value, "base64url");
}

function verifyBearerToken(request: Request): TokenClaims | null {
  const authorization = request.header("authorization");
  if (!authorization) return null;

  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) throw new Error("Malformed authorization header");

  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET is not configured with at least 32 bytes");
  }

  const parts = match[1].split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8")) as {
    alg?: string;
    typ?: string;
  };
  if (header.alg !== "HS256" || (header.typ && header.typ !== "JWT")) {
    throw new Error("Unsupported token algorithm");
  }

  const expected = createHmac("sha256", secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const actual = decodeBase64Url(parts[2]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid token signature");
  }

  const claims = JSON.parse(
    decodeBase64Url(parts[1]).toString("utf8"),
  ) as Partial<TokenClaims>;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    typeof claims.sub !== "string" ||
    !uuidPattern.test(claims.sub) ||
    typeof claims.exp !== "number" ||
    !Number.isFinite(claims.exp) ||
    (claims.nbf !== undefined && typeof claims.nbf !== "number")
  ) {
    throw new Error("Invalid token claims");
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now || (claims.nbf !== undefined && claims.nbf > now)) {
    throw new Error("Token is expired or not yet valid");
  }

  return claims as TokenClaims;
}

async function attachAuthenticatedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  optional: boolean,
): Promise<void> {
  let claims: TokenClaims | null;
  try {
    claims = verifyBearerToken(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token";
    const configurationError = message.startsWith("JWT_SECRET");
    res.status(configurationError ? 503 : 401).json({
      success: false,
      error: configurationError
        ? "Authentication is not configured"
        : "Invalid or expired token",
    });
    return;
  }

  if (!claims) {
    if (optional) {
      next();
      return;
    }
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      res
        .status(401)
        .json({ success: false, error: "User is inactive or does not exist" });
      return;
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    console.error("Authentication user lookup failed:", error);
    res
      .status(503)
      .json({ success: false, error: "Authentication service is unavailable" });
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void attachAuthenticatedUser(req as AuthenticatedRequest, res, next, false);
}

export function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void attachAuthenticatedUser(req as AuthenticatedRequest, res, next, true);
}
