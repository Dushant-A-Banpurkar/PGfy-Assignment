import express, { NextFunction, Request, Response } from "express";
import { redisConnection } from "./infrastructure/redis";
import { prisma } from "./infrastructure/prisma";
import adminPropertiesRouter from "./routes/adminProperties";
import enquiriesRouter from "./routes/enquiries";
import publicPropertiesRouter from "./routes/publicProperties";
import salesRouter from "./routes/sales";
import verificationRouter from "./routes/verification";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, redisConnection.ping()]);
    res.json({ success: true, status: "ready" });
  } catch (error) {
    console.error("Readiness check failed:", error);
    res.status(503).json({ success: false, status: "not_ready" });
  }
});

app.use(adminPropertiesRouter);
app.use(publicPropertiesRouter);
app.use(enquiriesRouter);
app.use(salesRouter);
app.use(verificationRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    res
      .status(400)
      .json({ success: false, error: "Malformed JSON request body" });
    return;
  }
  console.error("Unhandled request error:", error);
  res.status(500).json({ success: false, error: "Internal server error" });
});
