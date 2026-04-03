"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Bot,
  KeyRound,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { useState, useEffect, useRef, type RefObject } from "react";

/* ── Scroll-triggered animation hook ─────────────────────────────── */

function useInView(threshold = 0.15): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

export default function Home() {
  return <LandingPage />;
}

/* ── Landing Page ──────────────────────────────────────────────────── */

function LandingPage() {
  const [featuresRef, featuresInView] = useInView(0.1);
  const [stepsRef, stepsInView] = useInView(0.1);
  const [cryptoRef, cryptoInView] = useInView(0.2);
  const [ctaRef, ctaInView] = useInView(0.2);

  return (
    <div className="grain flex flex-col min-h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm animate-fade-in">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-foreground flex items-center justify-center">
                <Lock className="h-3 w-3 text-background" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                agentdocs
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignInButton />
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-20">
          <div className="max-w-2xl space-y-6">
            <div className="animate-fade-up delay-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
              API-first &middot; End-to-end encrypted
            </div>

            <h1 className="animate-fade-up delay-1 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
              Google Docs,
              <br />
              but for agents
            </h1>

            <p className="animate-fade-up delay-2 text-lg text-muted-foreground leading-relaxed max-w-lg">
              Documents, spreadsheets, and tickets your AI agents can read and
              write through a simple API. Every byte is end-to-end encrypted
              &mdash; we literally cannot read your data.
            </p>

            <div className="animate-fade-up delay-3 flex items-center gap-3 pt-2">
              <SignInButton size="lg" />
              <a
                href="https://github.com/uriva/agentdocs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View source
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Code example */}
          <div className="animate-code-reveal delay-5 mt-16 rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 ml-2">
                agent.ts
              </span>
            </div>
            <pre className="p-5 text-[13px] font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-muted-foreground">{"// Create a document with your agent's identity"}</span>
{"\n"}
                <span className="text-muted-foreground">{"const "}</span>
                <span className="text-foreground">response</span>
                <span className="text-muted-foreground"> = </span>
                <span className="text-muted-foreground">{"await "}</span>
                fetch(<span className="text-orange-400 dark:text-orange-300">&quot;/api/documents&quot;</span>, {"{"}
{"\n"}
                {"  "}method: <span className="text-orange-400 dark:text-orange-300">&quot;POST&quot;</span>,
{"\n"}
                {"  "}headers: signedHeaders(identityKey),
{"\n"}
                {"  "}body: JSON.stringify({"{"}
{"\n"}
                {"    "}encryptedTitle: <span className="text-muted-foreground">{"await "}</span>encrypt(title, docKey),
{"\n"}
                {"    "}type: <span className="text-orange-400 dark:text-orange-300">&quot;doc&quot;</span>,
{"\n"}
                {"  "}{"}"})
{"\n"}
                {"}"});
{"\n\n"}
                <span className="text-muted-foreground">{"// Share it with another agent or human"}</span>
{"\n"}
                <span className="text-muted-foreground">{"await "}</span>fetch(<span className="text-orange-400 dark:text-orange-300">{"`/api/documents/${docId}/share`"}</span>, {"{"}
{"\n"}
                {"  "}method: <span className="text-orange-400 dark:text-orange-300">&quot;POST&quot;</span>,
{"\n"}
                {"  "}headers: signedHeaders(identityKey),
{"\n"}
                {"  "}body: JSON.stringify({"{"}
{"\n"}
                {"    "}granteeId: otherAgentId,
{"\n"}
                {"    "}encryptedSymmetricKey: <span className="text-muted-foreground">{"await "}</span>ecdhWrap(docKey, theirPublicKey),
{"\n"}
                {"  "}{"}"})
{"\n"}
                {"}"});
              </code>
            </pre>
          </div>
        </section>

        {/* Features */}
        <section className="border-t" ref={featuresRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="grid sm:grid-cols-3 gap-10">
              <Feature
                icon={Bot}
                title="Built for agents"
                description="Every operation is an API call. No browser needed. Sign requests with your agent's Ed25519 private key and go."
                inView={featuresInView}
                delay={0}
              />
              <Feature
                icon={KeyRound}
                title="Unlimited identities"
                description="Create as many identities as you want for your army of bots. Each gets its own key pair. Share documents between them with ECDH key exchange."
                inView={featuresInView}
                delay={1}
              />
              <Feature
                icon={EyeOff}
                title="Zero-knowledge"
                description="AES-256-GCM encryption happens client-side. We store ciphertext. No plaintext titles, no plaintext content, no plaintext comments. Ever."
                inView={featuresInView}
                delay={2}
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t" ref={stepsRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2
              className={`text-2xl font-semibold tracking-tight mb-10 transition-all duration-500 ${
                stepsInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              How it works
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-16 gap-y-8">
              <Step
                number="01"
                title="Generate an identity"
                description="An Ed25519 signing key + X25519 encryption key are generated in your browser. The private keys never leave your device."
                inView={stepsInView}
                delay={1}
              />
              <Step
                number="02"
                title="Create documents via API"
                description="POST encrypted content to the API. Agents sign each request with their private key. We verify and store ciphertext."
                inView={stepsInView}
                delay={2}
              />
              <Step
                number="03"
                title="Share with key exchange"
                description="Grant access by wrapping the document's AES key with ECDH. The recipient unwraps with their private key. We never see the plaintext key."
                inView={stepsInView}
                delay={3}
              />
              <Step
                number="04"
                title="Collaborate across identities"
                description="Humans use the web app. Agents use the API. Same encrypted documents, same access model. Mix and match."
                inView={stepsInView}
                delay={4}
              />
            </div>
          </div>
        </section>

        {/* Crypto details */}
        <section className="border-t" ref={cryptoRef as React.RefObject<HTMLElement>}>
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div
              className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-mono text-muted-foreground/60 transition-all duration-700 ${
                cryptoInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              <span>Ed25519 signing</span>
              <span className="text-muted-foreground/20">|</span>
              <span>X25519 ECDH</span>
              <span className="text-muted-foreground/20">|</span>
              <span>AES-256-GCM</span>
              <span className="text-muted-foreground/20">|</span>
              <span>HKDF-SHA256</span>
              <span className="text-muted-foreground/20">|</span>
              <span>Web Crypto API</span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t" ref={ctaRef as React.RefObject<HTMLElement>}>
          <div
            className={`mx-auto max-w-4xl px-6 py-20 text-center transition-all duration-600 ${
              ctaInView
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-3">
              Give your agents a workspace
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Open source. Self-hostable. Takes 30 seconds to create your first
              identity.
            </p>
            <SignInButton size="lg" />
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  inView = true,
  delay = 0,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  inView?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`space-y-3 transition-all duration-500 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay * 150}ms` }}
    >
      <div className="h-9 w-9 rounded-lg bg-foreground/10 border border-foreground/20 flex items-center justify-center">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  inView = true,
  delay = 0,
}: {
  number: string;
  title: string;
  description: string;
  inView?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={`flex gap-4 transition-all duration-500 ${
        inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"
      }`}
      style={{ transitionDelay: `${delay * 150}ms` }}
    >
      <span className="text-[11px] font-mono text-foreground/60 pt-0.5 shrink-0">
        {number}
      </span>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function SignInButton({ size = "default" }: { size?: "default" | "lg" }) {
  const { sendMagicCode, signInWithMagicCode } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await sendMagicCode(email.trim());
      setStep("code");
    } catch {
      // toast not available on landing page, use alert
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await signInWithMagicCode(email.trim(), code.trim());
      router.push("/app");
    } catch {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        size={size === "lg" ? "lg" : "default"}
        className={size === "lg" ? "h-11 px-6 gap-2" : "h-8 px-3 gap-1.5 text-xs"}
        onClick={() => setOpen(true)}
      >
        Get Started
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {step === "email" ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            autoFocus
            className="h-8 w-52 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleSendCode}
            disabled={!email.trim() || loading}
          >
            {loading ? "..." : "Send Code"}
          </Button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
            autoFocus
            className="h-8 w-28 rounded-lg border bg-background px-2.5 text-xs font-mono text-center tracking-widest outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
          />
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleVerifyCode}
            disabled={!code.trim() || loading}
          >
            {loading ? "..." : "Verify"}
          </Button>
          <button
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            back
          </button>
        </>
      )}
    </div>
  );
}
