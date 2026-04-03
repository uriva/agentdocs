"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, ArrowRight, Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, user, sendMagicCode, signInWithMagicCode } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <SignInForm onSendCode={sendMagicCode} onVerifyCode={signInWithMagicCode} />;
  }

  return <>{children}</>;
}

function SignInForm({
  onSendCode,
  onVerifyCode,
}: {
  onSendCode: (email: string) => Promise<unknown>;
  onVerifyCode: (email: string, code: string) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await onSendCode(email.trim());
      setStep("code");
      toast.success("Check your email for a sign-in code");
    } catch {
      toast.error("Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await onVerifyCode(email.trim(), code.trim());
    } catch {
      toast.error("Invalid code — try again");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
        <p className="text-xs text-muted-foreground">
          {step === "email"
            ? "Enter your email to get a magic code"
            : `We sent a code to ${email}`}
        </p>
      </div>

      {step === "email" ? (
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            autoFocus
            className="h-10"
          />
          <Button
            onClick={handleSendCode}
            disabled={!email.trim() || loading}
            className="w-full h-10 gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Send Magic Code
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
            autoFocus
            className="h-10 text-center font-mono tracking-widest text-lg"
          />
          <Button
            onClick={handleVerifyCode}
            disabled={!code.trim() || loading}
            className="w-full h-10 gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Verify
          </Button>
          <button
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Use a different email
          </button>
        </div>
      )}
    </div>
  );
}
