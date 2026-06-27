import type { Request } from "express";

import type { UserRoleValue } from "../../modules/identity/constants";
import type { SessionRecord } from "../../modules/identity/identity.types";

export type AuthenticatedUser = {
  sessionId: string;
  userId: string;
  role: UserRoleValue;
  sessionTokenHash: string;
  session: SessionRecord;
};

export type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};