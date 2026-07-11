import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { SmsModule } from "../../infrastructure/sms/sms.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { SensitiveDataService } from "../../common/security/sensitive-data.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { IdentityController } from "./identity.controller";
import { IdentityRepository } from "./identity.repository";
import { IdentityService } from "./identity.service";
import { OtpChallengeService } from "./otp/otp-challenge.service";
import { IdentityRateLimiterService } from "./rate-limiter/identity-rate-limiter.service";
import { PasswordService } from "./security/password.service";
import { TokenHashService } from "./security/token-hash.service";
import { SessionService } from "./session/session.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { PartnerDocumentsService } from "./partner-documents.service";

@Module({
  imports: [PrismaModule, RedisStoreModule, SmsModule, StorageModule, RealtimeModule],
  controllers: [IdentityController, UsersController],
  providers: [
    IdentityRepository,
    IdentityService,
    UsersService,
    PartnerDocumentsService,
    SensitiveDataService,
    IdentityRateLimiterService,
    OtpChallengeService,
    SessionService,
    PasswordService,
    TokenHashService,
  ],
  exports: [SessionService, PartnerDocumentsService],
})
export class IdentityModule {}
