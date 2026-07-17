import app from "./app";
import { logger } from "./lib/logger";
import { ensureSystemCorrespondenceTemplates } from "./lib/seed-correspondence-templates";
import { ensureDefaultServiceTypes } from "./lib/seed-service-types";
import { runAutomationChecks, generateDueRecurringTasks } from "./routes/task-automation";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  ensureSystemCorrespondenceTemplates().catch((err) => {
    logger.error({ err }, "Failed to seed system correspondence templates");
  });

  ensureDefaultServiceTypes().catch((err) => {
    logger.error({ err }, "Failed to seed default service types");
  });

  // مركز إدارة العمليات: فحوصات دورية (اقتراب انتهاء ضمانات/تسجيلات، تأخر موردين استدلاليًا،
  // تنبيهات اقتراب/تجاوز الاستحقاق) + توليد المهام المتكررة المستحقة — بدون أي مكتبة cron جديدة.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  runAutomationChecks().catch((err) => logger.error({ err }, "Initial automation check failed"));
  generateDueRecurringTasks().catch((err) => logger.error({ err }, "Initial recurring task generation failed"));
  setInterval(() => { runAutomationChecks().catch((err) => logger.error({ err }, "automation check failed")); }, ONE_HOUR_MS);
  setInterval(() => { generateDueRecurringTasks().catch((err) => logger.error({ err }, "recurring task gen failed")); }, ONE_HOUR_MS);
});
