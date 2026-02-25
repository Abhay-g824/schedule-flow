import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

const Login = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      const redirectTo = (location.state as any)?.from || "/";
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-background px-4">
      <div className="w-full max-w-md p-6 bg-card border border-border/50 rounded-xl shadow-card">
        <h1 className="text-2xl font-display font-semibold mb-2">Sign in</h1>
        <p className="text-muted-foreground mb-6">Access your SERA AI scheduler</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-4">
          Don&apos;t have an account?{" "}
          <NavLink to="/signup" className="text-primary hover:underline">
            Sign up
          </NavLink>
        </p>

        <p className="text-sm text-muted-foreground mt-2">
          Forgot your password?{" "}
          <NavLink to="/forgot-password" className="text-primary hover:underline">
            Reset it here
          </NavLink>
        </p>
      </div>
    </div>
  );
};

export default Login;

