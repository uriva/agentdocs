"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fingerprint, type StoredIdentity } from "@/lib/identity-store";
import { type IdentityKeyPair } from "@/lib/crypto";
import { CreateIdentityDialog } from "./create-identity-dialog";
import { ExportIdentityDialog } from "./export-identity-dialog";
import { ImportIdentityDialog } from "./import-identity-dialog";
import { ChevronDown } from "lucide-react";

interface IdentitySwitcherProps {
  identities: StoredIdentity[];
  active: StoredIdentity | null;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => Promise<StoredIdentity>;
  onImport: (data: {
    id: string;
    name: string;
    keyPair: IdentityKeyPair;
  }) => void;
}

export function IdentitySwitcher({
  identities,
  active,
  onSwitch,
  onCreate,
  onImport,
}: IdentitySwitcherProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!active) {
    return (
      <div className="flex items-center gap-2">
        <ImportIdentityDialog
          onImport={onImport}
          trigger={
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs">
              Import
            </Button>
          }
        />
        <CreateIdentityDialog
          onCreateIdentity={onCreate}
          trigger={
            <Button size="sm" className="h-8 px-3 text-xs">
              Create Identity
            </Button>
          }
        />
      </div>
    );
  }

  const fp = active.keyPair?.signing?.publicKey
    ? fingerprint(active.keyPair.signing.publicKey)
    : "???";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex items-center h-8 gap-2 px-2.5 font-mono text-xs rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none"
      >
        <span
          className="h-2 w-2 rounded-full bg-foreground shrink-0"
          aria-hidden
        />
        <span className="max-w-[120px] truncate">{active.name}</span>
        <Badge
          variant="secondary"
          className="font-mono text-[10px] px-1.5 py-0"
        >
          {fp}
        </Badge>
        <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <div className="px-1.5 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Identities
          </div>
          <div className="px-1.5 pb-1 text-[10px] font-mono text-muted-foreground/60 break-all">
            Active: {active.id}
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          {identities.map((identity) => {
            const idFp = identity.keyPair?.signing?.publicKey
              ? fingerprint(identity.keyPair.signing.publicKey)
              : "???";
            return (
              <button
                type="button"
                key={identity.id}
                onClick={() => {
                  onSwitch(identity.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    identity.id === active.id
                      ? "bg-foreground"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <span className="flex-1 truncate text-sm">
                  {identity.name}
                </span>
                <code className="text-[10px] font-mono text-muted-foreground">
                  {idFp}
                </code>
              </button>
            );
          })}
          <div className="-mx-1 my-1 h-px bg-border" />
          <ExportIdentityDialog
            identity={active}
            trigger={
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Export Identity
              </button>
            }
          />
          <ImportIdentityDialog
            onImport={onImport}
            trigger={
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Import Identity
              </button>
            }
          />
          <CreateIdentityDialog
            onCreateIdentity={onCreate}
            trigger={
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                + New Identity
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
