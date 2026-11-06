import app from './app';
import { closeEnquiryNotificationQueue } from './queues/enquiryNotifications';
import { redisConnection } from './infrastructure/redis';
import prisma from './utils/prisma';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

async function start(): Promise<void> {
  await prisma.$connect();
  await redisConnection.ping();

  const server = app.listen(port, () => {
    console.log(`PGfy backend listening on port ${port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing server`);
    server.close(async (error) => {
      try {
        await closeEnquiryNotificationQueue();
        await redisConnection.quit();
        await prisma.$disconnect();
      } finally {
        if (error) {
          console.error('Failed to close HTTP server:', error);
          process.exitCode = 1;
        }
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (error: unknown) => {
  console.error('Failed to start backend:', error);
  await Promise.allSettled([
    closeEnquiryNotificationQueue(),
    prisma.$disconnect(),
  ]);
  redisConnection.disconnect();
  process.exitCode = 1;
});
