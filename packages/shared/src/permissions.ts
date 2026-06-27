import { UserRole } from "./enums.js";

export const PermissionAction = {
  StaffRegister: "identity:staff:register",
  UsersRead: "users:read",
  UsersBan: "users:ban",
  PartnersReadPending: "partners:read-pending",
  PartnersReview: "partners:review",
  OwnProfileRead: "profile:own:read",
  OwnProfileUpdate: "profile:own:update",
  OwnAddressManage: "profile:own:addresses:manage",
  PartnerProfileSubmit: "partner:profile:submit",
  PartnerOnlineUpdate: "partner:online:update",
  PartnerLocationUpdate: "partner:location:update",
  PaymentRefundCreate: "payments:refund:create",
  CouponsManage: "ops:coupons:manage",
  SystemConfigManage: "ops:config:manage",
  SupportTicketsManage: "ops:support:manage",
  AuditRead: "ops:audit:read",
  FinanceLedgerRead: "finance:ledger:read",
  FinanceWalletAdjust: "finance:wallet:adjust",
  FinancePayoutManage: "finance:payouts:manage",
  FinanceInvoiceManage: "finance:invoices:manage",
  FinanceReconciliationRead: "finance:reconciliation:read",
  PlatformAnalyticsRead: "platform:analytics:read",
  PlatformFeatureFlagsManage: "platform:feature-flags:manage",
  PlatformSearchRebuildManage: "platform:search:rebuild",
  StoreManage: "marketplace:store:manage",
  StoreReview: "marketplace:store:review",
} as const;

export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const PASSWORD_LOGIN_ROLES = [
  UserRole.SUPPORT,
  UserRole.FINANCE,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
] as const;

export type PasswordLoginRole = (typeof PASSWORD_LOGIN_ROLES)[number];

export const PERMISSION_MATRIX = {
  [UserRole.CUSTOMER]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.OwnAddressManage,
  ],
  [UserRole.RESTAURANT]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.PartnerProfileSubmit,
    PermissionAction.PartnerOnlineUpdate,
    PermissionAction.PartnerLocationUpdate,
    PermissionAction.StoreManage,
  ],
  [UserRole.DELIVERY]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.PartnerProfileSubmit,
    PermissionAction.PartnerOnlineUpdate,
    PermissionAction.PartnerLocationUpdate,
  ],
  [UserRole.DRIVER]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.PartnerProfileSubmit,
    PermissionAction.PartnerOnlineUpdate,
    PermissionAction.PartnerLocationUpdate,
  ],
  [UserRole.SUPPORT]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.UsersRead,
    PermissionAction.PartnersReadPending,
    PermissionAction.PaymentRefundCreate,
    PermissionAction.SupportTicketsManage,
  ],
  [UserRole.FINANCE]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.UsersRead,
    PermissionAction.PaymentRefundCreate,
    PermissionAction.AuditRead,
    PermissionAction.FinanceLedgerRead,
    PermissionAction.FinanceWalletAdjust,
    PermissionAction.FinancePayoutManage,
    PermissionAction.FinanceInvoiceManage,
    PermissionAction.FinanceReconciliationRead,
    PermissionAction.PlatformAnalyticsRead,
  ],
  [UserRole.ADMIN]: [
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.UsersRead,
    PermissionAction.UsersBan,
    PermissionAction.PartnersReadPending,
    PermissionAction.PartnersReview,
    PermissionAction.StoreReview,
    PermissionAction.CouponsManage,
    PermissionAction.SupportTicketsManage,
    PermissionAction.AuditRead,
    PermissionAction.PlatformAnalyticsRead,
    PermissionAction.PlatformFeatureFlagsManage,
    PermissionAction.PlatformSearchRebuildManage,
  ],
  [UserRole.SUPER_ADMIN]: [
    PermissionAction.StaffRegister,
    PermissionAction.OwnProfileRead,
    PermissionAction.OwnProfileUpdate,
    PermissionAction.UsersRead,
    PermissionAction.UsersBan,
    PermissionAction.PartnersReadPending,
    PermissionAction.PartnersReview,
    PermissionAction.PaymentRefundCreate,
    PermissionAction.StoreReview,
    PermissionAction.CouponsManage,
    PermissionAction.SystemConfigManage,
    PermissionAction.SupportTicketsManage,
    PermissionAction.AuditRead,
    PermissionAction.FinanceLedgerRead,
    PermissionAction.FinanceWalletAdjust,
    PermissionAction.FinancePayoutManage,
    PermissionAction.FinanceInvoiceManage,
    PermissionAction.FinanceReconciliationRead,
    PermissionAction.PlatformAnalyticsRead,
    PermissionAction.PlatformFeatureFlagsManage,
    PermissionAction.PlatformSearchRebuildManage,
  ],
} as const satisfies Record<UserRole, readonly PermissionAction[]>;

export function hasPermission(role: UserRole | `${UserRole}`, action: PermissionAction): boolean {
  const permissions = (PERMISSION_MATRIX[role as UserRole] ?? []) as readonly PermissionAction[];
  return permissions.includes(action);
}

export function canPasswordLogin(role: UserRole | `${UserRole}`): boolean {
  return (PASSWORD_LOGIN_ROLES as readonly string[]).includes(role);
}
