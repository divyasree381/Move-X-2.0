import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { RedisStoreModule } from "../../infrastructure/redis/redis-store.module";
import { SmsModule } from "../../infrastructure/sms/sms.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { IdentityController } from "./identity.controller";
import { IdentityRepository } from "./identity.repository";
import { IdentityService } from "./identity.service";
import { OtpChallengeService } from "./otp/otp-challenge.service";
import { IdentityRateLimiterService } from "./rate-limiter/identity-rate-limiter.service";
import { MfaService } from "./security/mfa.service";
import { PasswordService } from "./security/password.service";
import { TokenHashService } from "./security/token-hash.service";
import { SessionService } from "./session/session.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [PrismaModule, RedisStoreModule, SmsModule, RealtimeModule],
  controllers: [IdentityController, UsersController],
  providers: [
    IdentityRepository,
    IdentityService,
    UsersService,
    IdentityRateLimiterService,
    OtpChallengeService,
    MfaService,
    SessionService,
    PasswordService,
    TokenHashService,
  ],
  exports: [SessionService],
})
export class IdentityModule {}
