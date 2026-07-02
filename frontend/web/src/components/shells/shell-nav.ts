import { PermissionAction, type UserRole, hasPermission } from "@movex/shared";
import { BadgeIndianRupee, BarChart3, Bike, ClipboardList, FileClock, FileText, Flag, GitCompareArrows, Headphones, Home, Landmark, MapPinned, Package, PackageCheck, ReceiptText, Search, Settings, ShieldCheck, Store, Tags, UserRound, Users, Wallet } from "lucide-react";
import type { ComponentType } from "react";

export type ShellNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  permission?: PermissionAction;
};

export const customerNav: ShellNavItem[] = [
  { label: "Home", href: "/customer", icon: Home, permission: PermissionAction.OwnProfileRead },
  { label: "Orders", href: "/customer/orders", icon: ClipboardList, permission: PermissionAction.OwnProfileRead },
  { label: "Rides", href: "/customer/rides", icon: Bike, permission: PermissionAction.OwnProfileRead },
  { label: "Courier", href: "/customer/couriers", icon: Package, permission: PermissionAction.OwnProfileRead },
  { label: "Home Services", href: "/customer/home-services", icon: Home, permission: PermissionAction.OwnProfileRead },
  { label: "Wallet", href: "/customer/wallet", icon: Wallet, permission: PermissionAction.OwnProfileRead },
  { label: "Profile", href: "/customer/profile", icon: UserRound, permission: PermissionAction.OwnProfileRead },
];

export const partnerNav: ShellNavItem[] = [
  { label: "Queue", href: "/partner/dashboard", icon: PackageCheck, permission: PermissionAction.PartnerOnlineUpdate },
  { label: "Courier", href: "/partner/couriers", icon: Package, permission: PermissionAction.PartnerOnlineUpdate },
  { label: "Services", href: "/partner/home-services", icon: Home, permission: PermissionAction.PartnerOnlineUpdate },
  { label: "Ride Queue", href: "/partner/rides", icon: Bike, permission: PermissionAction.PartnerOnlineUpdate },
  { label: "Location", href: "/partner/location", icon: MapPinned, permission: PermissionAction.PartnerLocationUpdate },
  { label: "Verification", href: "/partner/onboarding", icon: Store, permission: PermissionAction.PartnerProfileSubmit },
];

export const opsNav: ShellNavItem[] = [
  { label: "Analytics", href: "/ops/analytics", icon: BarChart3, permission: PermissionAction.PlatformAnalyticsRead },
  { label: "Feature Flags", href: "/ops/feature-flags", icon: Flag, permission: PermissionAction.PlatformFeatureFlagsManage },
  { label: "Search", href: "/ops/search", icon: Search, permission: PermissionAction.PlatformSearchRebuildManage },
  { label: "Users", href: "/ops/users", icon: Users, permission: PermissionAction.UsersRead },
  { label: "Partners", href: "/ops/partners", icon: ShieldCheck, permission: PermissionAction.PartnersReadPending },
  { label: "Stores", href: "/ops/stores", icon: Store, permission: PermissionAction.StoreReview },
  { label: "Coupons", href: "/ops/coupons", icon: Tags, permission: PermissionAction.CouponsManage },
  { label: "Config", href: "/ops/config", icon: Settings, permission: PermissionAction.SystemConfigManage },
  { label: "Refunds", href: "/ops/refunds", icon: BadgeIndianRupee, permission: PermissionAction.PaymentRefundCreate },
  { label: "Ledger", href: "/ops/ledger", icon: FileText, permission: PermissionAction.FinanceLedgerRead },
  { label: "Payouts", href: "/ops/payouts", icon: Landmark, permission: PermissionAction.FinancePayoutManage },
  { label: "Invoices", href: "/ops/invoices", icon: ReceiptText, permission: PermissionAction.FinanceInvoiceManage },
  { label: "Reconcile", href: "/ops/reconciliation", icon: GitCompareArrows, permission: PermissionAction.FinanceReconciliationRead },
  { label: "Support", href: "/ops/support", icon: Headphones, permission: PermissionAction.SupportTicketsManage },
  { label: "Disputes", href: "/ops/disputes", icon: ShieldCheck, permission: PermissionAction.SupportTicketsManage },
  { label: "Audit", href: "/ops/audit", icon: FileClock, permission: PermissionAction.AuditRead },
];

export function navForRole(role: UserRole, items: ShellNavItem[]) {
  return items.filter((item) => !item.permission || hasPermission(role, item.permission));
}
