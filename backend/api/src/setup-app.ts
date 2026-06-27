import { ValidationPipe, VersioningType, type INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { createPinoLoggerMiddleware } from "./common/middleware/pino-logger.middleware";
import { requestContextMiddleware } from "./common/middleware/request-context.middleware";
import { SanitizePipe } from "./common/pipes/sanitize.pipe";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { isExactAllowedOrigin } from "./common/utils/origin.util";

export function setupApp(app: INestApplication): INestApplication {
  app.use(requestContextMiddleware);
  app.use(createPinoLoggerMiddleware());
  app.use(cookieParser());
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || isExactAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin denied"), false);
    },
    credentials: true,
  });

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  setupSwagger(app);

  return app;
}

function setupSwagger(app: INestApplication): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle("MoveX API")
    .setDescription("MoveX API gateway")
    .setVersion("1.0")
    .addCookieAuth(process.env.SESSION_COOKIE_NAME ?? "__Host-movex_session")
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

