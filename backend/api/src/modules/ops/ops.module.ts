import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { OpsController } from "./ops.controller";
import { OpsService } from "./ops.service";

@Module({
  imports: [PrismaModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}