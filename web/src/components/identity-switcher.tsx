"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fingerprint, type StoredIdentity } from "@/lib/identity-store";
import { type IdentityKeyPair } from "@/lib/crypto";
import { CreateIdentityDialog } from "./create-identity-dialog";
import { ExportIdentityDialog } from "./export-identity-dialog";
import { ImportIdentityDialog } from "./import-identity-dialog";

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
    <div className="flex items-center gap-2">
      <ExportIdentityDialog
        identity={active}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
          >
            Export
          </Button>
        }
      />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="inline-flex items-center h-8 gap-2 px-2.5 font-mono text-xs rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Identities
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {identities.map((identity) => {
            const idFp = identity.keyPair?.signing?.publicKey
              ? fingerprint(identity.keyPair.signing.publicKey)
              : "???";
            return (
              <DropdownMenuItem
                key={identity.id}
                onClick={() => onSwitch(identity.id)}
                className="flex items-center gap-2 cursor-pointer"
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
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setMenuOpen(false)}
            className="cursor-pointer text-sm text-muted-foreground p-0"
          >
            <ImportIdentityDialog
              onImport={onImport}
              trigger={
                <span className="flex items-center w-full px-1.5 py-1 cursor-pointer">
                  Import Identity
                </span>
              }
            />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setMenuOpen(false)}
            className="cursor-pointer text-sm text-muted-foreground p-0"
          >
            <CreateIdentityDialog
              onCreateIdentity={onCreate}
              trigger={
                <span className="flex items-center w-full px-1.5 py-1 cursor-pointer">
                  + New Identity
                </span>
              }
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
