import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, type AccountRole } from "@/lib/auth";

export function RequireAuth({ children, role }: { children: ReactNode; role: AccountRole }) {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !profile)) void navigate({ to: "/", replace: true });
  }, [loading, navigate, profile, user]);

  if (loading || !user || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Checking your account…
        </div>
      </main>
    );
  }

  if (profile.role !== role) {
    const correctRoute = profile.role === "investor" ? "/dashboard" : "/advisor";
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
          <ShieldAlert className="mx-auto h-8 w-8 text-cgsi-red" />
          <h1 className="mt-3 text-lg font-semibold text-cgsi-navy">Wrong workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is for {role}s. Your account is registered as an {profile.role}.
          </p>
          <Button
            className="mt-5 w-full bg-cgsi-navy"
            onClick={() => void navigate({ to: correctRoute })}
          >
            Go to my workspace
          </Button>
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => void signOut().then(() => navigate({ to: "/" }))}
          >
            Sign out
          </Button>
        </div>
      </main>
    );
  }

  return children;
}
