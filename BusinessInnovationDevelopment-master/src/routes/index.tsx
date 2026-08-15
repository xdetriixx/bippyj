import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, type AccountRole } from "@/lib/auth";
import { getPasswordStrength, PASSWORD_REQUIREMENTS, validateEmail } from "@/lib/auth-validation";
import { PhoneChassis } from "@/components/layout/PhoneChassis";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Login - CGSI Decision Intelligence" },
      { name: "description", content: "Sign in or create a CGSI investor or advisor account." },
    ],
  }),
  component: Login,
});

type FormMode = "login" | "signup";

function accountRoute(role: AccountRole) {
  return role === "investor" ? "/dashboard" : "/advisor";
}

function friendlyAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error && typeof error.code === "string"
      ? error.code
      : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "An account already exists for this email. Try signing in instead.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/operation-not-allowed":
      "Email/password sign-in is not enabled in Firebase Authentication yet.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/weak-password": "Your password does not meet the required security rules.",
    "auth/network-request-failed": "Could not reach Firebase. Check your connection and try again.",
  };
  return (
    messages[code] ??
    (error instanceof Error ? error.message : "Authentication failed. Please try again.")
  );
}

function Login() {
  const navigate = useNavigate();
  const { profile, loading: authLoading, configured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<FormMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("investor");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = Boolean(confirmPassword) && password === confirmPassword;

  useEffect(() => {
    if (!authLoading && profile) void navigate({ to: accountRoute(profile.role), replace: true });
  }, [authLoading, navigate, profile]);

  function switchMode(nextMode: FormMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    if (mode === "signup" && displayName.trim().length < 2) {
      setError("Enter a full name with at least 2 characters.");
      return;
    }

    if (mode === "signup" && !passwordStrength.isValid) {
      setError("Create a stronger password that meets every requirement below.");
      return;
    }

    if (mode === "signup" && !passwordsMatch) {
      setError("Both password fields must match.");
      return;
    }

    setSubmitting(true);
    try {
      const nextProfile =
        mode === "login"
          ? await signIn(email, password)
          : await signUp({ displayName, email, password, role });
      await navigate({ to: accountRoute(nextProfile.role), replace: true });
    } catch (nextError) {
      setError(friendlyAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PhoneChassis scrollable screenClassName="bg-cgsi-grey text-foreground">
      <main className="flex min-h-full flex-col">
        <section className="bg-cgsi-navy px-5 pb-8 pt-10 text-white">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-cgsi-red text-lg font-bold">
              C
            </div>
            <div>
              <div className="text-sm font-semibold">CGS International</div>
              <div className="text-xs text-white/70">Decision Intelligence</div>
            </div>
          </div>

          <h1 className="text-3xl font-semibold leading-tight">
            {mode === "login" ? "Welcome back." : "Create your workspace."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Securely access the investor dashboard or advisor research workspace with your own
            account.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric icon={BarChart3} label="Markets" />
            <Metric icon={LockKeyhole} label="Secure login" />
            <Metric icon={UserRound} label="Two roles" />
          </div>
        </section>

        <section className="-mt-4 flex flex-1 items-start rounded-t-2xl bg-cgsi-grey px-4 pb-8 pt-4">
          <Card className="w-full border-0 p-5 shadow-lg">
            <div
              className="grid grid-cols-2 rounded-lg bg-slate-100 p-1"
              role="tablist"
              aria-label="Account access"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => switchMode("login")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === "login" ? "bg-white text-cgsi-navy shadow-sm" : "text-slate-500"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => switchMode("signup")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  mode === "signup" ? "bg-white text-cgsi-navy shadow-sm" : "text-slate-500"
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mb-5 mt-5">
              <h2 className="text-xl font-semibold text-cgsi-navy">
                {mode === "login" ? "Sign in to your account" : "Set up your account"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Your saved role will open the correct workspace."
                  : "Choose a role now; it will be saved with your profile."}
              </p>
            </div>

            {!configured && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  Firebase configuration is missing. Add the VITE_FIREBASE_* values and restart the
                  app.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="display-name">Full name</Label>
                  <Input
                    id="display-name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  maxLength={254}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "signup" ? "Create a strong password" : "Your password"}
                    minLength={mode === "signup" ? 8 : 1}
                    maxLength={128}
                    aria-describedby={
                      mode === "signup" ? "password-strength password-requirements" : undefined
                    }
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-cgsi-navy"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "signup" && (
                  <PasswordStrength password={password} strength={passwordStrength} />
                )}
              </div>

              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={8}
                      maxLength={128}
                      aria-invalid={Boolean(confirmPassword) && !passwordsMatch}
                      aria-describedby="confirm-password-status"
                      required
                    />
                    <p
                      id="confirm-password-status"
                      className={`text-xs ${
                        !confirmPassword
                          ? "text-muted-foreground"
                          : passwordsMatch
                            ? "text-emerald-700"
                            : "text-destructive"
                      }`}
                      aria-live="polite"
                    >
                      {!confirmPassword
                        ? "Re-enter your password."
                        : passwordsMatch
                          ? "Passwords match."
                          : "Passwords do not match."}
                    </p>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Account role</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <RoleOption
                        role="investor"
                        selected={role === "investor"}
                        onSelect={setRole}
                        icon={UserRound}
                        description="Market dashboard"
                      />
                      <RoleOption
                        role="advisor"
                        selected={role === "advisor"}
                        onSelect={setRole}
                        icon={BriefcaseBusiness}
                        description="Research tools"
                      />
                    </div>
                  </fieldset>
                </>
              )}

              <Button
                type="submit"
                className="h-11 w-full bg-cgsi-navy"
                disabled={submitting || authLoading || !configured}
              >
                {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              Passwords are handled securely by Firebase Authentication and are never stored in
              Firestore.
            </p>
          </Card>
        </section>
      </main>
    </PhoneChassis>
  );
}

function PasswordStrength({
  password,
  strength,
}: {
  password: string;
  strength: ReturnType<typeof getPasswordStrength>;
}) {
  const barColor =
    strength.score <= 1
      ? "bg-red-500"
      : strength.score === 2
        ? "bg-orange-500"
        : strength.score === 3
          ? "bg-amber-500"
          : strength.score === 4
            ? "bg-lime-600"
            : "bg-emerald-600";

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-3">
      <div id="password-strength" className="flex items-center justify-between text-xs">
        <span className="font-medium text-cgsi-navy">Password strength</span>
        <span
          className={strength.isValid ? "font-medium text-emerald-700" : "text-muted-foreground"}
        >
          {strength.label}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={strength.percentage}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${strength.percentage}%` }}
        />
      </div>
      <ul id="password-requirements" className="grid gap-1 text-xs sm:grid-cols-2">
        {PASSWORD_REQUIREMENTS.map((requirement) => {
          const met = requirement.test(password);
          return (
            <li
              key={requirement.label}
              className={`flex items-center gap-1.5 ${met ? "text-emerald-700" : "text-muted-foreground"}`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  met ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"
                }`}
                aria-hidden="true"
              >
                {met && <Check className="h-3 w-3" />}
              </span>
              {requirement.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoleOption({
  role,
  selected,
  onSelect,
  icon: Icon,
  description,
}: {
  role: AccountRole;
  selected: boolean;
  onSelect: (role: AccountRole) => void;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <label
      className={`cursor-pointer rounded-lg border p-3 transition ${
        selected ? "border-cgsi-navy bg-slate-50 ring-1 ring-cgsi-navy" : "hover:bg-slate-50"
      }`}
    >
      <input
        type="radio"
        name="role"
        value={role}
        checked={selected}
        onChange={() => onSelect(role)}
        className="sr-only"
      />
      <Icon className="h-5 w-5 text-cgsi-navy" />
      <div className="mt-2 text-sm font-semibold capitalize text-cgsi-navy">{role}</div>
      <div className="text-[11px] text-muted-foreground">{description}</div>
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <Icon className="mb-2 h-4 w-4 text-cgsi-green" />
      <div className="text-[11px] font-medium text-white/80">{label}</div>
    </div>
  );
}
