import { Suspense } from "react";

import { StaffResetPasswordPage } from "@/components/auth/login-page";

export default function StaffResetPasswordRoute() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <StaffResetPasswordPage />
    </Suspense>
  );
}

function AuthPageFallback() {
  return <main className="min-h-screen bg-background" aria-busy="true" aria-label="Loading password reset" />;
}