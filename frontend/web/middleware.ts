import { NextResponse, type NextRequest } from "next/server";

const CUSTOMER_ROLES = new Set(["CUSTOMER"]);
const PARTNER_ROLES = new Set(["RESTAURANT", "DELIVERY", "DRIVER"]);
const OPS_ROLES = new Set(["SUPPORT", "FINANCE", "ADMIN", "SUPER_ADMIN"]);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/customer") && !pathname.startsWith("/partner") && !pathname.startsWith("/ops")) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get("has_session")?.value === "1" || request.cookies.get("has_session")?.value === "true";
  const role = request.cookies.get("movex_role")?.value;

  if (!hasSession) {
    return redirect(request, "/");
  }

  if (!role) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/customer") && !CUSTOMER_ROLES.has(role)) {
    return redirectForRole(request, role);
  }

  if (pathname.startsWith("/partner") && !PARTNER_ROLES.has(role)) {
    return redirectForRole(request, role);
  }

  if (pathname.startsWith("/ops") && !OPS_ROLES.has(role)) {
    return redirectForRole(request, role);
  }

  return NextResponse.next();
}

function redirectForRole(request: NextRequest, role: string) {
  if (CUSTOMER_ROLES.has(role)) {
    return redirect(request, "/customer");
  }
  if (PARTNER_ROLES.has(role)) {
    return redirect(request, "/partner");
  }
  if (OPS_ROLES.has(role)) {
    return redirect(request, "/ops");
  }
  return redirect(request, "/");
}

function redirect(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/customer/:path*", "/partner/:path*", "/ops/:path*"],
};