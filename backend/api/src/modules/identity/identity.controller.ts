import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";
import { PermissionAction } from "@movex/shared";
import type { Request, Response } from "express";

import { RequirePermission } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestWithUser } from "../../common/types/authenticated-request";
import { AdminAcceptInvitationDto } from "./dto/admin-accept-invitation.dto";
import { AdminBootstrapDto } from "./dto/admin-bootstrap.dto";
import { AdminChangePasswordDto } from "./dto/admin-change-password.dto";
import { AdminForgotPasswordDto } from "./dto/admin-forgot-password.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { AdminRegisterDto } from "./dto/admin-register.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { OtpRequestDto } from "./dto/otp-request.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";
import { IdentityService } from "./identity.service";
import type { SessionRecord } from "./identity.types";
import { SessionService } from "./session/session.service";

@Controller("auth")
export class IdentityController {
  constructor(
    @Inject(IdentityService) private readonly identityService: IdentityService,
    @Inject(SessionService) private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Get("permissions")
  permissions() {
    return this.identityService.getPermissionMatrix();
  }

  @Public()
  @ApiBody({ type: OtpRequestDto })
  @Post("otp/request")
  async requestOtp(@Body() body: OtpRequestDto, @Req() request: Request) {
    return this.identityService.requestOtp(body, this.sessionService.toRequestMetadata(request));
  }

  @Public()
  @ApiBody({ type: OtpVerifyDto })
  @Post("otp/verify")
  async verifyOtp(@Body() body: OtpVerifyDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.identityService.verifyOtp(body, this.sessionService.toRequestMetadata(request));
    this.setSessionCookies(response, result.session.token, result.session.maxAgeSeconds);

    return {
      user: result.user,
    };
  }

  @Public()
  @ApiBody({ type: AdminLoginDto })
  @Post("admin/login")
  async adminLogin(@Body() body: AdminLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.identityService.loginAdmin(body, this.sessionService.toRequestMetadata(request));
    this.setSessionCookies(response, result.session.token, result.session.maxAgeSeconds);

    return {
      user: result.user,
    };
  }

  @Public()
  @ApiBody({ type: AdminForgotPasswordDto })
  @Post("admin/password/forgot")
  async forgotAdminPassword(@Body() body: AdminForgotPasswordDto, @Req() request: Request) {
    return this.identityService.requestStaffPasswordReset(body, this.sessionService.toRequestMetadata(request));
  }

  @Public()
  @ApiBody({ type: AdminResetPasswordDto })
  @Post("admin/password/reset")
  async resetAdminPassword(@Body() body: AdminResetPasswordDto) {
    return this.identityService.resetStaffPassword(body);
  }

  @Public()
  @ApiBody({ type: AdminAcceptInvitationDto })
  @Post("admin/invitations/accept")
  async acceptAdminInvitation(@Body() body: AdminAcceptInvitationDto) {
    return this.identityService.acceptStaffInvitation(body);
  }

  @ApiBody({ type: AdminChangePasswordDto })
  @Post("admin/password/change")
  async changeAdminPassword(@Body() body: AdminChangePasswordDto, @Req() request: RequestWithUser) {
    return this.identityService.changeStaffPassword(this.getRequestSession(request), body);
  }
  @Public()
  @ApiBody({ type: AdminBootstrapDto })
  @Post("admin/bootstrap")
  async adminBootstrap(@Body() body: AdminBootstrapDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.identityService.bootstrapSuperAdmin(body, this.sessionService.toRequestMetadata(request));
    this.setSessionCookies(response, result.session.token, result.session.maxAgeSeconds);

    return {
      user: result.user,
    };
  }

  @RequirePermission(PermissionAction.StaffRegister)
  @Post("admin/users/:userId/invitation")
  async resendAdminInvitation(@Param("userId") userId: string) {
    return this.identityService.resendStaffInvitation(userId);
  }
  @ApiBody({ type: AdminRegisterDto })
  @RequirePermission(PermissionAction.StaffRegister)
  @Post("admin/register")
  async adminRegister(@Body() body: AdminRegisterDto) {
    return {
      user: await this.identityService.registerStaff(body),
    };
  }

  @Get("me")
  async me(@Req() request: RequestWithUser) {
    const session = this.getRequestSession(request);
    return {
      user: await this.identityService.getMe(session),
    };
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = this.sessionService.getSessionTokenFromRequest(request);

    if (token) {
      await this.sessionService.revokeToken(token);
    }

    this.clearSessionCookies(response);
    return { message: "Logged out" };
  }

  @Post("logout-all")
  async logoutAll(@Req() request: RequestWithUser, @Res({ passthrough: true }) response: Response) {
    const session = this.getRequestSession(request);
    await this.sessionService.revokeAllForUser(session.userId);
    this.clearSessionCookies(response);
    return { message: "Logged out everywhere" };
  }

  private setSessionCookies(response: Response, token: string, maxAgeSeconds: number): void {
    const maxAge = maxAgeSeconds * 1000;

    response.cookie(this.sessionService.getSessionCookieName(), token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookie(this.sessionService.getHasSessionCookieName(), "1", {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(this.sessionService.getSessionCookieName(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    response.clearCookie(this.sessionService.getHasSessionCookieName(), {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  }

  private getRequestSession(request: RequestWithUser): SessionRecord {
    if (!request.user?.session) {
      throw new Error("Authenticated request is missing session context.");
    }

    return request.user.session;
  }
}
