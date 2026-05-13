import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button, Input, Card } from "./ui";
import { authApi } from "../lib/auth";

export function LoginPage() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await authApi.register({ email, password, name });
        // After registration, log in automatically
        await login(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <Card style={{ width: "400px", padding: "2rem", background: "white" }}>
        <h1 style={{ marginBottom: "1.5rem", textAlign: "center", fontSize: "1.75rem", fontWeight: "bold" }}>
          {isRegister ? "Create Account" : "Welcome to Mira"}
        </h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {isRegister && (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>
                Name
              </label>
              <Input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>
              Email
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>
              Password
            </label>
            <Input
              type="password"
              placeholder={isRegister ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
          </div>
          {error && (
            <div style={{
              color: "#ef4444",
              fontSize: "0.875rem",
              padding: "0.5rem",
              background: "#fee2e2",
              borderRadius: "0.375rem"
            }}>
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Please wait..." : isRegister ? "Register" : "Login"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            disabled={loading}
            style={{ width: "100%" }}
          >
            {isRegister ? "Already have an account? Login" : "Need an account? Register"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
