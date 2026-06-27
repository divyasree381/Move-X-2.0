import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";

async function main(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
  process.env.AUTH_HASH_SECRET = process.env.AUTH_HASH_SECRET ?? "openapi-generation-secret";
  process.env.CONFIG_SECRET_KEY = process.env.CONFIG_SECRET_KEY ?? "openapi-generation-config-secret";
  process.env.MFA_SECRET_KEY = process.env.MFA_SECRET_KEY ?? "openapi-generation-mfa-secret";
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

  const app = await NestFactory.create(AppModule, { rawBody: true, logger: false });
  setupApp(app);
  await app.init();

  const config = new DocumentBuilder()
    .setTitle("MoveX API")
    .setDescription("Generated OpenAPI contract for MoveX clients")
    .setVersion("1.0")
    .addCookieAuth(process.env.SESSION_COOKIE_NAME ?? "__Host-movex_session")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(__dirname, "../../../packages/shared/src/generated/openapi.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await app.close();
}

void main();
