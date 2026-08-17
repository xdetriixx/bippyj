import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import SocialScanApp from "@/features/social-scan/App";

export const Route = createFileRoute("/social-scan")({
  head: () => ({
    meta: [
      { title: "Social Scan - CGSI Decision Intelligence" },
      { name: "description", content: "Live social-media ESG monitoring for advisor research." },
    ],
  }),
  component: SocialScan,
});

function SocialScan() {
  return (
    <RequireAuth role="advisor">
      <SocialScanApp />
    </RequireAuth>
  );
}