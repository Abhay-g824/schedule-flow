import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode, useEffect, useState } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, fetchUserProfile } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (token && user && (user.onboarding_completed === undefined || user.onboarding_completed === null)) {
      // Fetch profile if we don't have onboarding status
      fetchUserProfile().finally(() => setCheckingOnboarding(false));
    } else {
      setCheckingOnboarding(false);
    }
  }, [token, user, fetchUserProfile]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is on onboarding page but already completed, redirect to home
  if (user && user.onboarding_completed === 1 && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  // Check if onboarding is not completed and redirect to onboarding
  if (user && (user.onboarding_completed === 0 || user.onboarding_completed === null || user.onboarding_completed === undefined) && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}



