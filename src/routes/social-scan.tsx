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
      {/* Standalone route, not linked from anywhere in the app anymore — the
          live entry point is Insights → Social Scan inside the advisor
          workspace, which supplies company from the parsed report. No PDF
          context exists here, so there's nothing to derive a company from. */}
      <SocialScanApp company="" />
    </RequireAuth>
  );
}