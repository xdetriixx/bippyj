import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { validateEmail, validateNewPassword } from "@/lib/auth-validation";

export type AccountRole = "investor" | "advisor";

export type AccountProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: AccountRole;
};

type SignUpDetails = {
  displayName: string;
  email: string;
  password: string;
  role: AccountRole;
};

type AuthContextValue = {
  user: User | null;
  profile: AccountProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AccountProfile>;
  signUp: (details: SignUpDetails) => Promise<AccountProfile>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseProfile(user: User, data: Record<string, unknown>): AccountProfile | null {
  if (data.role !== "investor" && data.role !== "advisor") return null;
  return {
    uid: user.uid,
    email: typeof data.email === "string" ? data.email : (user.email ?? ""),
    displayName: typeof data.displayName === "string" ? data.displayName : (user.displayName ?? ""),
    role: data.role,
  };
}

async function loadProfile(user: User): Promise<AccountProfile | null> {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  return snapshot.exists() ? parseProfile(user, snapshot.data()) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser || nextUser.isAnonymous) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        setProfile(await loadProfile(nextUser));
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth || !db) throw new Error("Firebase is not configured for this app.");
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const nextProfile = await loadProfile(credential.user);
    if (!nextProfile) {
      await firebaseSignOut(auth);
      throw new Error("This account does not have a valid investor or advisor profile.");
    }
    setUser(credential.user);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const signUp = useCallback(async ({ displayName, email, password, role }: SignUpDetails) => {
    if (!auth || !db) throw new Error("Firebase is not configured for this app.");
    if (displayName.trim().length < 2)
      throw new Error("Enter a full name with at least 2 characters.");
    if (!validateEmail(email)) throw new Error("Enter a valid email address.");
    if (!validateNewPassword(password)) {
      throw new Error("Your password does not meet all of the security requirements.");
    }
    const configuredAuth = auth;
    const credential = await createUserWithEmailAndPassword(configuredAuth, email.trim(), password);
    const cleanName = displayName.trim();
    const accountEmail = credential.user.email ?? email.trim();
    try {
      await updateProfile(credential.user, { displayName: cleanName });
      await setDoc(doc(db, "users", credential.user.uid), {
        displayName: cleanName,
        email: accountEmail,
        role,
      });
    } catch (error) {
      await deleteUser(credential.user).catch(() => firebaseSignOut(configuredAuth));
      throw error;
    }
    const nextProfile: AccountProfile = {
      uid: credential.user.uid,
      email: accountEmail,
      displayName: cleanName,
      role,
    };
    setUser(credential.user);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, configured: isFirebaseConfigured, signIn, signUp, signOut }),
    [user, profile, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
