import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  {
    maxRetriesPerRequest: null,
    connectTimeout: 10_000,
    retryStrategy: (attempt) =>
      attempt > 10 ? null : Math.min(attempt * 500, 5_000),
  },
);

redisConnection.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});
