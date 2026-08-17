import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import AdvisorOriginalApp from "@/features/advisor-original/App";
import "@/features/advisor-original/advisor.css";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth";

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
      <AdvisorWorkspace />
    </RequireAuth>
  );
}

function AdvisorWorkspace() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  async function leaveWorkspace() {
    await signOut();
    await navigate({ to: "/" });
  }

  return (
    <div className="relative">
      <div className="fixed right-4 top-4 z-[100] flex gap-2">
        <button
          type="button"
          onClick={() => void leaveWorkspace()}
          className="inline-flex items-center gap-2 rounded-full border bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur hover:bg-slate-50"
          aria-label={`Sign out ${profile?.displayName || "advisor"}`}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
      <AdvisorOriginalApp />
    </div>
  );
}
