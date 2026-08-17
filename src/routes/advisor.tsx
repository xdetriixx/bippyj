import { createFileRoute } from "@tanstack/react-router";
import AdvisorOriginalApp from "@/features/advisor-original/App";
import "@/features/advisor-original/advisor.css";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "Advisor - CGSI Decision Intelligence" },
      {
        name: "description",
        content: "Advisor workspace for annual report analysis and business model evaluation.",
      },
    ],
  }),
  component: Advisor,
});

function Advisor() {
  return (
    <RequireAuth role="advisor">
      <AdvisorOriginalApp />
    </RequireAuth>
  );
}
