import "dotenv/config";
import {
  startEnquiryNotificationWorker,
  stopEnquiryNotificationWorker,
} from "./enquiryNotifications";

async function start(): Promise<void> {
  await startEnquiryNotificationWorker();
  console.log("Enquiry notification worker is ready");

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received; stopping notification worker`);
    void stopEnquiryNotificationWorker().catch((error: unknown) => {
      console.error("Failed to stop notification worker cleanly:", error);
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(async (error: unknown) => {
  console.error("Failed to start notification worker:", error);
  await stopEnquiryNotificationWorker().catch((shutdownError: unknown) => {
    console.error(
      "Failed to clean up after worker startup error:",
      shutdownError,
    );
  });
  process.exitCode = 1;
});
