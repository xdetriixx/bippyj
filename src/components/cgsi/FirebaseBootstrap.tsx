import { useEffect } from "react";
import { getFirebaseAnalytics } from "@/lib/firebase";

export function FirebaseBootstrap() {
  useEffect(() => {
    void getFirebaseAnalytics().catch(() => {
      // Firebase is optional while local environment values are not configured.
    });
  }, []);

  return null;
}
