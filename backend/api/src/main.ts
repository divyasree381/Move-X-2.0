import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { setupApp } from "./setup-app";
import { validateProductionReadiness } from "./common/security/production-readiness";
import { startObservability } from "./observability";

async function bootstrap(): Promise<void> {
  validateProductionReadiness();
  await startObservability("api");
  const app = await NestFactory.create(AppModule, { rawBody: true });
  setupApp(app);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
