"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PermissionAction, canPasswordLogin } from "@movex/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquare, Scale, ShieldOff, Ticket, UserPlus, XCircle } from "lucide-react";

import { QueryState } from "@/providers/query-state";
import { useOpsPermission } from "@/components/shells";
import { Button, Dialog, DialogContent, DialogTrigger, EmptyState, Input, Skeleton, StatusPill } from "@/components/ui";
import {
  addTicketMessage,
  adminUsers,
  banUser,
  createCoupon,
  createRefund,
  actionOpsDispute,
  createTicket,
  deactivateCoupon,
  getAdminPartnerVerification,
  getTicket,
  opsAudit,
  opsDisputes,
  opsConfig,
  opsCoupons,
  opsTickets,
  pendingPartners,
  pendingStores,
  registerStaffAccount,
  resendStaffInvitation,
  reviewPartner,
  reviewStore,
  suspendStore,
  unbanUser,
  updateTicket,
  resolveOpsDispute,
  upsertConfig,
  type OpsCoupon,
  type OpsDispute,
  type OpsTicket,
  type StaffLoginRole,
} from "@/lib/api";

export function OpsUsersPage() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const banAccess = useOpsPermission(PermissionAction.UsersBan);
  const staffAccess = useOpsPermission(PermissionAction.StaffRegister);
  const role = params.get("role") ?? undefined;
  const users = useQuery({
    queryKey: ["ops-users", role],
    queryFn: () => adminUsers({ role, limit: 50 }),
  });
  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => banUser(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-users"] }),
  });
  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-users"] }),
  });
  const invitationMutation = useMutation({
    mutationFn: resendStaffInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-users"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.UsersRead}>
      <OpsPanel title="Users" description="Search staff, customers, and partners, then apply the controls allowed for your role." filters={<RoleFilter />}>
        <>
          {staffAccess.can ? (
            <StaffAccountCreator onCreated={() => queryClient.invalidateQueries({ queryKey: ["ops-users"] })} />
          ) : null}
          <QueryState isLoading={users.isLoading} isError={users.isError} error={users.error} onRetry={() => users.refetch()}>
            <DataTable headers={["User", "Role", "Partner", "State", "Actions"]} empty="No users found">
              {(users.data?.items ?? []).map((user) => {
                const staffAccount = canPasswordLogin(user.role);
                const canManage = banAccess.can && (!staffAccount || banAccess.role === "SUPER_ADMIN");

                return (
                  <tr key={user.id} className="border-t border-border">
                    <Cell><Primary text={user.name ?? user.email ?? user.phoneE164 ?? user.id} sub={user.email ?? user.phoneE164 ?? user.id} /></Cell>
                    <Cell><StatusPill label={user.role} tone="info" /></Cell>
                    <Cell>{user.partnerApproval}</Cell>
                    <Cell>{user.isBanned ? "Banned" : !user.emailVerifiedAt || user.mustChangePassword ? "Activation pending" : user.isOnline ? "Online" : "Active"}</Cell>
                    <Cell>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" disabled={banMutation.isPending || user.isBanned} onClick={() => banMutation.mutate({ id: user.id, reason: "Ops console action" })}><ShieldOff className="size-4" aria-hidden="true" /> Ban</Button>
                          <Button size="sm" variant="ghost" disabled={unbanMutation.isPending || !user.isBanned} onClick={() => unbanMutation.mutate(user.id)}>Unban</Button>
                          {staffAccess.can && staffAccount && !user.emailVerifiedAt ? (
                            <Button size="sm" variant="ghost" disabled={invitationMutation.isPending || user.isBanned} onClick={() => invitationMutation.mutate(user.id)}>Resend invite</Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{staffAccount && banAccess.can ? "Super Admin only" : "Read only"}</span>
                      )}
                    </Cell>
                  </tr>
                );
              })}
            </DataTable>
          </QueryState>
        </>
      </OpsPanel>
    </PermissionBoundary>
  );
}

const STAFF_ROLES = ["SUPPORT", "FINANCE", "ADMIN", "SUPER_ADMIN"] as const;

function StaffAccountCreator({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; phone: string; role: StaffLoginRole; password: string }>({
    name: "",
    email: "",
    phone: "",
    role: "SUPPORT",
    password: "",
  });
  const mutation = useMutation({
    mutationFn: () => registerStaffAccount({
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    }),
    onSuccess: () => {
      onCreated();
      setForm({ name: "", email: "", phone: "", role: "SUPPORT", password: "" });
      setOpen(false);
    },
  });
  const canSubmit = form.email.trim().length > 3 && form.password.length >= 12 && !mutation.isPending;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 border-y border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Staff access</p>
        <p className="mt-1 text-xs text-muted-foreground">Create a role-limited staff account and send an email activation link.</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button><UserPlus className="size-4" aria-hidden="true" /> Create staff</Button>
        </DialogTrigger>
        <DialogContent title="Create staff account" description="The temporary password permits first sign-in; the email invitation verifies and activates the account.">
          <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">Full name<Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></label>
              <label className="space-y-1.5 text-sm font-medium">Role<select className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as StaffLoginRole }))}>{STAFF_ROLES.map((role) => <option key={role} value={role}>{role.replace("_", " ")}</option>)}</select></label>
            </div>
            <label className="space-y-1.5 text-sm font-medium">Email<Input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></label>
            <label className="space-y-1.5 text-sm font-medium">Phone <span className="font-normal text-muted-foreground">(optional)</span><Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" placeholder="+91 98765 43210" /></label>
            <label className="space-y-1.5 text-sm font-medium">Temporary password<Input required type="password" minLength={12} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" /></label>
            {mutation.error ? <p role="alert" className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : "Could not create the staff account."}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!canSubmit}>{mutation.isPending ? "Creating..." : "Create account"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function OpsPartnersPage() {
  const queryClient = useQueryClient();
  const reviewAccess = useOpsPermission(PermissionAction.PartnersReview);
  const partners = useQuery({ queryKey: ["ops-pending-partners"], queryFn: () => pendingPartners({ limit: 50 }),
  });
  const mutation = useMutation({ mutationFn: ({ id, approval }: { id: string; approval: "APPROVED" | "REJECTED" }) => reviewPartner(id, approval, approval === "REJECTED" ? "Rejected from ops console" : undefined,
      ), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-pending-partners"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.PartnersReadPending}>
      <OpsPanel title="Partner Approvals" description="Review restaurant, delivery, and driver partner onboarding requests.">
        <QueryState isLoading={partners.isLoading} isError={partners.isError} error={partners.error} onRetry={() => partners.refetch()}>
          <DataTable headers={["Partner", "Role", "Verification", "Submitted", "Actions"]} empty="No pending partners">
            {(partners.data?.items ?? []).map((partner) => (
              <tr key={partner.id} className="border-t border-border">
                <Cell><Primary text={partner.name ?? partner.email ?? partner.phoneE164 ?? partner.id} sub={partner.id} /></Cell>
                <Cell><StatusPill label={partner.role} tone="info" /></Cell>
                <Cell><PartnerVerificationCell userId={partner.id} /></Cell>
                <Cell>{partner.partnerApproval}</Cell>
                <Cell>{reviewAccess.can ? (
                    <ReviewButtons onApprove={() => mutation.mutate({ id: partner.id, approval: "APPROVED" })} onReject={() => mutation.mutate({ id: partner.id, approval: "REJECTED" })} disabled={mutation.isPending} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Review locked</span>
                  )}</Cell>
              </tr>
            ))}
          </DataTable>
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}

export function OpsStoresPage() {
  const queryClient = useQueryClient();
  const stores = useQuery({ queryKey: ["ops-pending-stores"], queryFn: () => pendingStores({ limit: 50 }),
  });
  const review = useMutation({ mutationFn: ({ id, approval }: { id: string; approval: "APPROVED" | "REJECTED" }) => reviewStore(id, approval, approval === "REJECTED" ? "Rejected from ops console" : undefined), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-pending-stores"] }),
  });
  const suspend = useMutation({ mutationFn: suspendStore, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-pending-stores"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.StoreReview}>
      <OpsPanel title="Store Approvals" description="Approve, reject, or suspend stores from the marketplace catalogue.">
        <QueryState isLoading={stores.isLoading} isError={stores.isError} error={stores.error} onRetry={() => stores.refetch()}>
          <DataTable headers={["Store", "Type", "Location", "Actions"]} empty="No stores pending review">
            {(stores.data?.items ?? []).map((store) => (
              <tr key={store.id} className="border-t border-border">
                <Cell><Primary text={store.name} sub={store.id} /></Cell>
                <Cell><StatusPill label={store.type} tone="info" /></Cell>
                <Cell>{Number(store.lat).toFixed(3)}, {Number(store.lng).toFixed(3)}</Cell>
                <Cell><div className="flex flex-wrap gap-2"><ReviewButtons onApprove={() => review.mutate({ id: store.id, approval: "APPROVED" })} onReject={() => review.mutate({ id: store.id, approval: "REJECTED" })} disabled={review.isPending} /><Button size="sm" variant="secondary" onClick={() => suspend.mutate(store.id)} disabled={suspend.isPending}>Suspend</Button></div></Cell>
              </tr>
            ))}
          </DataTable>
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}

export function OpsCouponsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: "MOVE10", title: "Launch offer", serviceType: "", campaignName: "Launch campaign", campaignTag: "LAUNCH", firstOrderOnly: false, discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT", discountValue: "10",
  });
  const coupons = useQuery({ queryKey: ["ops-coupons"], queryFn: () => opsCoupons({ limit: 50 }) });
  const create = useMutation({ mutationFn: () => createCoupon({ ...form, serviceType: form.serviceType || undefined, discountValue: Number(form.discountValue), isActive: true,
      }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-coupons"] }),
  });
  const deactivate = useMutation({ mutationFn: deactivateCoupon, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-coupons"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.CouponsManage}>
      <OpsPanel title="Coupons" description="Manage customer-facing discounts used by checkout pricing." filters={<div className="grid gap-2 md:grid-cols-4"><Input value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} /><Input value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} /><select className="rounded-md border border-border bg-surface px-3 text-sm" value={form.serviceType} onChange={(e) => setForm((v) => ({ ...v, serviceType: e.target.value }))}><option value="">All verticals</option><option>FOOD</option><option>GROCERY</option><option>PHARMACY</option><option>RIDE</option><option>COURIER</option><option>HOME_SERVICE</option></select><Input value={form.campaignName} onChange={(e) => setForm((v) => ({ ...v, campaignName: e.target.value }))} /><Input value={form.campaignTag} onChange={(e) => setForm((v) => ({ ...v, campaignTag: e.target.value }))} /><select className="rounded-md border border-border bg-surface px-3 text-sm" value={form.discountType} onChange={(e) => setForm((v) => ({ ...v, discountType: e.target.value as "PERCENTAGE" | "FLAT" }))}><option>PERCENTAGE</option><option>FLAT</option></select><Input value={form.discountValue} onChange={(e) => setForm((v) => ({ ...v, discountValue: e.target.value }))} /><label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm"><input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm((v) => ({ ...v, firstOrderOnly: e.target.checked }))} />{" "}
              First booking</label><Button onClick={() => create.mutate()} disabled={create.isPending}>Create</Button></div>}>
        <QueryState isLoading={coupons.isLoading} isError={coupons.isError} error={coupons.error} onRetry={() => coupons.refetch()}>
          <DataTable headers={["Code", "Discount", "Usage", "State", "Actions"]} empty="No coupons">
            {(coupons.data?.items ?? []).map((coupon) => (
              <CouponRow key={coupon.id} coupon={coupon} onDeactivate={() => deactivate.mutate(coupon.id)} disabled={deactivate.isPending} />))}
          </DataTable>
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}

export function OpsConfigPage() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("maps.provider");
  const [value, setValue] = useState('{"active":"google"}');
  const [isSecret, setIsSecret] = useState(false);
  const configs = useQuery({ queryKey: ["ops-config"], queryFn: () => opsConfig({ limit: 50 }) });
  const save = useMutation({ mutationFn: () => upsertConfig(key, { value: JSON.parse(value) as Record<string, unknown>, isSecret, description: "Updated from ops console",
      }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-config"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.SystemConfigManage}>
      <OpsPanel title="System Config" description="Secret values are encrypted at rest and masked in reads." filters={<div className="grid gap-2 md:grid-cols-[12rem_1fr_auto_auto]"><Input value={key} onChange={(e) => setKey(e.target.value)} /><Input value={value} onChange={(e) => setValue(e.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} />{" "}
              Secret</label><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></div>}>
        <QueryState isLoading={configs.isLoading} isError={configs.isError} error={configs.error} onRetry={() => configs.refetch()}>
          <DataTable headers={["Key", "Value", "Secret", "Updated"]} empty="No config values">
            {(configs.data?.items ?? []).map((config) => (
              <tr key={config.key} className="border-t border-border"><Cell><Primary text={config.key} sub={config.description ?? "No description"} /></Cell><Cell><code className="text-xs">{JSON.stringify(config.value)}</code></Cell><Cell>{config.isSecret ? "Yes" : "No"}</Cell><Cell>{new Date(config.updatedAt).toLocaleString()}</Cell></tr>))}
          </DataTable>
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}


export function OpsDisputesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const disputes = useQuery({ queryKey: ["ops-disputes", status], queryFn: () => opsDisputes({ limit: 50, status: status || undefined }),
  });
  const action = useMutation({ mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) => actionOpsDispute(id, { action: nextStatus === "UNDER_REVIEW" ? "REVIEW_STARTED" : "SUPPORT_ACTION", status: nextStatus, note: "Updated from dispute queue",
      }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-disputes"] }),
  });
  const resolve = useMutation({ mutationFn: (id: string) => resolveOpsDispute(id, { action: "RESOLVED", status: "RESOLVED", resolution: "NO_ACTION", note: "Resolved from dispute queue",
      }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-disputes"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.SupportTicketsManage}>
      <OpsPanel title="Dispute Resolution" description="Linked customer, partner, reference, and support action trail." filters={<div className="grid gap-2 md:grid-cols-[12rem_auto]"><select className="rounded-md border border-border bg-surface px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All states</option><option>OPEN</option><option>UNDER_REVIEW</option><option>RESOLVED</option><option>REJECTED</option></select><StatusPill label="Audit-backed" tone="info" /></div>}>
        <QueryState isLoading={disputes.isLoading} isError={disputes.isError} error={disputes.error} onRetry={() => disputes.refetch()}>
          <DataTable headers={["Dispute", "Reference", "Customer / Partner", "Trail", "Actions"]} empty="No disputes">
            {(disputes.data?.items ?? []).map((dispute) => (
              <DisputeRow key={dispute.id} dispute={dispute} onReview={() => action.mutate({ id: dispute.id, nextStatus: "UNDER_REVIEW" })} onResolve={() => resolve.mutate(dispute.id)} disabled={action.isPending || resolve.isPending} />))}
          </DataTable>
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}
export function OpsSupportPage() {
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const [referenceId, setReferenceId] = useState(search.get("referenceId") ?? "");
  const [referenceType, setReferenceType] = useState(search.get("referenceType") ?? "ORDER");
  const tickets = useQuery({ queryKey: ["ops-tickets", search.toString()], queryFn: () => opsTickets({ status: search.get("status") ?? undefined, referenceId: search.get("referenceId") ?? undefined, referenceType: search.get("referenceType") ?? undefined, limit: 50,
      }),
  });
  const create = useMutation({ mutationFn: () => createTicket({ subject: `${referenceType} support`, message: `Opened from ops console for ${referenceId}`, priority: "HIGH", referenceType, referenceId,
      }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-tickets"] }),
  });

  return (
    <PermissionBoundary action={PermissionAction.SupportTicketsManage}>
      <OpsPanel title="Support Tickets" description="Find linked orders/rides, open cases, and continue support threads." filters={<div className="grid gap-2 md:grid-cols-[8rem_1fr_auto]"><select className="rounded-md border border-border bg-surface px-3 text-sm" value={referenceType} onChange={(e) => setReferenceType(e.target.value)}><option>ORDER</option><option>RIDE</option></select><Input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="Reference id" /><Button disabled={!referenceId || create.isPending} onClick={() => create.mutate()}><Ticket className="size-4" aria-hidden="true" /> Open ticket</Button></div>}>
        <QueryState isLoading={tickets.isLoading} isError={tickets.isError} error={tickets.error} onRetry={() => tickets.refetch()}>
          <DataTable headers={["Ticket", "Reference", "Priority", "Status", "Actions"]} empty="No tickets">
            {(tickets.data?.items ?? []).map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />))}
          </DataTable>
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}

export function OpsTicketDetailPage({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const refundAccess = useOpsPermission(PermissionAction.PaymentRefundCreate);
  const [message, setMessage] = useState("");
  const ticket = useQuery({ queryKey: ["ops-ticket", ticketId], queryFn: () => getTicket(ticketId),
  });
  const update = useMutation({ mutationFn: (status: string) => updateTicket(ticketId, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ops-ticket", ticketId] }),
  });
  const send = useMutation({ mutationFn: () => addTicketMessage(ticketId, message), onSuccess: () => { setMessage(""); queryClient.invalidateQueries({ queryKey: ["ops-ticket", ticketId] }); },
  });
  const refund = useMutation({ mutationFn: () => createRefund({ referenceType: ticket.data?.referenceType as "ORDER" | "RIDE", referenceId: ticket.data?.referenceId ?? "", reason: `Support ticket ${ticketId}`,
      }),
  });

  return (
    <PermissionBoundary action={PermissionAction.SupportTicketsManage}>
      <OpsPanel title="Ticket Detail" description="Support action thread and linked reference controls.">
        <QueryState isLoading={ticket.isLoading} isError={ticket.isError} error={ticket.error} onRetry={() => ticket.refetch()}>
          {ticket.data ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]"><section className="rounded-md border border-border bg-surface p-4"><Primary text={ticket.data.subject} sub={`${ticket.data.referenceType ?? "NO_REF"} ${ticket.data.referenceId ?? ""}`} /><div className="mt-4 space-y-3">{(ticket.data.messages ?? []).map((item) => (
                    <div key={item.id} className="rounded-md border border-border bg-surface-muted p-3"><p className="text-xs text-muted-foreground">{item.actorRole} - {new Date(item.createdAt).toLocaleString()}</p><p className="mt-1 text-sm text-foreground">{item.message}</p></div>))}</div><div className="mt-4 flex gap-2"><Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write a support update" /><Button disabled={!message || send.isPending} onClick={() => send.mutate()}><MessageSquare className="size-4" aria-hidden="true" /> Send</Button></div></section><aside className="h-fit space-y-3 rounded-md border border-border bg-surface p-4"><StatusPill label={ticket.data.status} tone="info" /><Button className="w-full" variant="secondary" onClick={() => update.mutate("IN_PROGRESS")}>Mark in progress</Button><Button className="w-full" variant="secondary" onClick={() => update.mutate("RESOLVED")}>Resolve</Button>{refundAccess.can && ["ORDER", "RIDE"].includes(ticket.data.referenceType ?? "") ? (
                  <Button className="w-full" disabled={refund.isPending} onClick={() => refund.mutate()}>Trigger refund</Button>
                ) : null}{refund.isSuccess ? <p className="text-sm text-success">Refund initiated</p> : null}</aside></div>
          ) : null}
        </QueryState>
      </OpsPanel>
    </PermissionBoundary>
  );
}

type RefundReferenceType = "ORDER" | "RIDE" | "COURIER" | "HOME_SERVICE" | "WALLET_TOPUP";

export function OpsRefundsPage() {
  const [referenceType, setReferenceType] = useState<RefundReferenceType>("ORDER");
  const [referenceId, setReferenceId] = useState("");
  const [reason, setReason] = useState("Customer support refund");
  const refund = useMutation({ mutationFn: () => createRefund({ referenceType, referenceId, reason }),
  });
  return (
    <PermissionBoundary action={PermissionAction.PaymentRefundCreate}><OpsPanel title="Refunds" description="Initiate refunds for eligible paid bookings."><div className="grid gap-3 rounded-md border border-border bg-surface p-4 md:grid-cols-[8rem_1fr_1fr_auto]"><select className="rounded-md border border-border bg-surface px-3 text-sm" value={referenceType} onChange={(e) => setReferenceType(e.target.value as RefundReferenceType)}><option>ORDER</option><option>RIDE</option><option>COURIER</option><option>HOME_SERVICE</option><option>WALLET_TOPUP</option></select><Input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="Reference id" /><Input value={reason} onChange={(e) => setReason(e.target.value)} /><Button disabled={!referenceId || refund.isPending} onClick={() => refund.mutate()}>Create refund</Button></div>{refund.isSuccess ? (
          <p className="text-sm text-success">Refund initiated successfully.</p>
        ) : null}{refund.error ? (
          <p className="text-sm text-destructive">{refund.error instanceof Error ? refund.error.message : "Refund failed"}</p>
        ) : null}</OpsPanel></PermissionBoundary>
  );
}

export function OpsAuditPage() {
  const logs = useQuery({ queryKey: ["ops-audit"], queryFn: () => opsAudit({ limit: 50 }) });
  return (
    <PermissionBoundary action={PermissionAction.AuditRead}><OpsPanel title="Audit Log" description="Mutating staff actions with redacted request metadata."><QueryState isLoading={logs.isLoading} isError={logs.isError} error={logs.error} onRetry={() => logs.refetch()}><DataTable headers={["Action", "Actor", "Entity", "Created"]} empty="No audit logs">{(logs.data?.items ?? []).map((log) => (
              <tr key={log.id} className="border-t border-border"><Cell><Primary text={log.action} sub={JSON.stringify(log.metadata)} /></Cell><Cell>{log.actor?.email ?? log.actorId ?? "System"}</Cell><Cell>{log.entityType} {log.entityId}</Cell><Cell>{new Date(log.createdAt).toLocaleString()}</Cell></tr>))}</DataTable></QueryState></OpsPanel></PermissionBoundary>
  );
}

function PermissionBoundary({ action, children,
}: { action: PermissionAction; children: ReactNode;
}) {
  const access = useOpsPermission(action);

  if (access.isLoading) {
    return <Skeleton className="h-48" />;
  }

  if (!access.can) {
    return (
      <EmptyState title="No access" description="This view is hidden by the permission matrix for your role." />
    );
  }

  return <>{children}</>;
}

function OpsPanel({ title, description, filters, children,
}: { title: string; description: string; filters?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="space-y-4"><section className="rounded-md border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><StatusPill label="URL filters" tone="info" /></div>{filters ? <div className="mt-4">{filters}</div> : null}</section>{children}</div>
  );
}

function DataTable({ headers, empty, children,
}: { headers: string[]; empty: string; children: ReactNode;
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted-foreground"><tr>{headers.map((header) => (
              <th key={header} className="px-3 py-2 font-semibold">{header}</th>))}</tr></thead><tbody>{children}</tbody></table>{!rows || (Array.isArray(rows) && rows.length === 0) ? (
        <EmptyState title={empty} description="Adjust filters or check back later." />
      ) : null}</div>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}

function Primary({ text, sub }: { text: string; sub?: string }) {
  return (
    <div><p className="font-medium text-foreground">{text}</p>{sub ? <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{sub}</p> : null}</div>
  );
}

function ReviewButtons({ onApprove, onReject, disabled,
}: { onApprove: () => void; onReject: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={disabled} onClick={onApprove}><CheckCircle2 className="size-4" aria-hidden="true" /> Approve</Button><Button size="sm" variant="secondary" disabled={disabled} onClick={onReject}><XCircle className="size-4" aria-hidden="true" /> Reject</Button></div>
  );
}

function PartnerVerificationCell({ userId }: { userId: string }) {
  const verification = useQuery({ queryKey: ["ops-partner-verification", userId], queryFn: () => getAdminPartnerVerification(userId),
  });

  if (verification.isLoading) {
    return <span className="text-xs text-muted-foreground">Loading...</span>;
  }

  if (!verification.data) {
    return <span className="text-xs text-muted-foreground">No full pack yet</span>;
  }

  const profile = verification.data.profile;
  const address = verification.data.address;
  const documents = verification.data.documents;
  const settlements = verification.data.settlements;
  const files = documents.files && typeof documents.files === "object" ? Object.keys(documents.files as Record<string, unknown>).length : 0;
  const bankReady = Boolean(settlements.accountHolderName && settlements.ifscCode);

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{String(profile.businessName ?? profile.ownerName ?? verification.data.partnerKind)}</p>
      <p>{String(address.city ?? "Location pending")} - {files} document files</p>
      <div className="flex flex-wrap gap-1">
        <StatusPill label={verification.data.status} tone={verification.data.status === "REJECTED" ? "danger" : verification.data.status === "APPROVED" ? "success" : "warning"} />
        <StatusPill label={bankReady ? "Bank ready" : "Bank missing"} tone={bankReady ? "success" : "warning"} />
      </div>
    </div>
  );
}
function RoleFilter() {
  const router = useRouter();
  return (
    <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm" onChange={(e) => router.push(e.target.value ? `/ops/users?role=${e.target.value}` : "/ops/users")} defaultValue=""><option value="">All roles</option><option>CUSTOMER</option><option>RESTAURANT</option><option>DELIVERY</option><option>DRIVER</option><option>SUPPORT</option><option>FINANCE</option><option>ADMIN</option><option>SUPER_ADMIN</option></select>
  );
}

function CouponRow({ coupon, onDeactivate, disabled,
}: { coupon: OpsCoupon; onDeactivate: () => void; disabled?: boolean;
}) {
  return (
    <tr className="border-t border-border"><Cell><Primary text={coupon.code} sub={coupon.title} /></Cell><Cell>{coupon.discountType} {coupon.discountValue}</Cell><Cell>{coupon.usageCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}</Cell><Cell><StatusPill label={coupon.isActive ? "Active" : "Inactive"} tone={coupon.isActive ? "success" : "warning"} /></Cell><Cell><Button size="sm" variant="secondary" disabled={disabled || !coupon.isActive} onClick={onDeactivate}>Deactivate</Button></Cell></tr>
  );
}

function TicketRow({ ticket }: { ticket: OpsTicket }) {
  return (
    <tr className="border-t border-border"><Cell><Primary text={ticket.subject} sub={ticket.id} /></Cell><Cell>{ticket.referenceType ?? "-"} {ticket.referenceId ?? ""}</Cell><Cell><StatusPill label={ticket.priority} tone={ticket.priority === "URGENT" || ticket.priority === "HIGH" ? "danger" : "warning"} /></Cell><Cell><StatusPill label={ticket.status} tone={ticket.status === "RESOLVED" ? "success" : "info"} /></Cell><Cell><Button asChild size="sm" variant="secondary"><Link href={`/ops/support/${ticket.id}`}>Open</Link></Button></Cell></tr>
  );
}
function DisputeRow({ dispute, onReview, onResolve, disabled,
}: { dispute: OpsDispute; onReview: () => void; onResolve: () => void; disabled?: boolean;
}) {
  return (
    <tr className="border-t border-border"><Cell><Primary text={dispute.summary} sub={dispute.id} /><div className="mt-2 flex flex-wrap gap-1"><StatusPill label={dispute.reason} tone="warning" /><StatusPill label={dispute.status} tone={dispute.status === "RESOLVED" ? "success" : dispute.status === "REJECTED" ? "danger" : "info"} /></div></Cell><Cell>{dispute.referenceType} {dispute.referenceId}<p className="mt-1 text-xs text-muted-foreground">Ticket {dispute.supportTicketId}</p></Cell><Cell><Primary text={dispute.customer?.name ?? dispute.customer?.email ?? dispute.customerId} sub={dispute.partner ? `Partner ${dispute.partner.name ?? dispute.partner.email ?? dispute.partnerId}` : "No partner assigned"} /></Cell><Cell>{dispute.actions.length} actions{dispute.actions.at(-1) ? (
          <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">{dispute.actions.at(-1)?.action}: {dispute.actions.at(-1)?.note ?? "No note"}</p>
        ) : null}</Cell><Cell><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={disabled || dispute.status !== "OPEN"} onClick={onReview}><Scale className="size-4" aria-hidden="true" /> Review</Button><Button size="sm" disabled={disabled || ["RESOLVED", "REJECTED"].includes(dispute.status)} onClick={onResolve}>Resolve</Button><Button asChild size="sm" variant="ghost"><Link href={`/ops/support/${dispute.supportTicketId}`}>Ticket</Link></Button></div></Cell></tr>
  );
}
