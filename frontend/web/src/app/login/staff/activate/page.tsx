import { Suspense } from "react";

import { StaffActivationPage } from "@/components/auth/login-page";

export default function StaffActivationRoute() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <StaffActivationPage />
    </Suspense>
  );
}

function AuthPageFallback() {
  return <main className="min-h-screen bg-background" aria-busy="true" aria-label="Loading staff activation" />;
}