import { strict as assert } from "node:assert";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup-app";

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  setupApp(app);
  await app.init();

  return app;
}

async function main(): Promise<void> {
  const app = await createApp();
  const server = app.getHttpServer();

  try {
    const publicResponse = await request(server).get("/api/v1/sample/public").expect(200);
    assert.equal(publicResponse.body.success, true);
    assert.equal(publicResponse.body.statusCode, 200);
    assert.deepEqual(publicResponse.body.data, { message: "public ok" });

    const errorResponse = await request(server).get("/api/v1/sample/error").expect(400);
    assert.equal(errorResponse.body.success, false);
    assert.equal(errorResponse.body.statusCode, 400);
    assert.equal(errorResponse.body.errorCode, "VALIDATION_ERROR");
    assert.equal(errorResponse.body.message, "sample error");

    const protectedResponse = await request(server).get("/api/v1/sample/protected").expect(401);
    assert.equal(protectedResponse.body.success, false);
    assert.equal(protectedResponse.body.statusCode, 401);
    assert.equal(protectedResponse.body.errorCode, "UNAUTHENTICATED");

    await request(server).get("/api/v1/sample/throttle").expect(200);
    await request(server).get("/api/v1/sample/throttle").expect(200);
    const throttledResponse = await request(server).get("/api/v1/sample/throttle").expect(429);
    assert.equal(throttledResponse.body.success, false);
    assert.equal(throttledResponse.body.statusCode, 429);
    assert.equal(throttledResponse.body.errorCode, "RATE_LIMITED");
  } finally {
    await app.close();
  }
}

void main();
