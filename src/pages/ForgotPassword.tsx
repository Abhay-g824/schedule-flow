import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

const ForgotPassword = () => {
  const { forgotPassword, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await forgotPassword(email, newPassword);
      setSuccess("Password updated. You can now sign in.");
      setTimeout(() => navigate("/login"), 800);
    } catch (err: any) {
      setError(err.message || "Reset failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center app-background px-4">
      <div className="w-full max-w-md p-6 bg-card border border-border/50 rounded-xl shadow-card">
        <h1 className="text-2xl font-display font-semibold mb-2">Forgot password</h1>
        <p className="text-muted-foreground mb-6">Enter your account email and set a new password.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="New password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;









