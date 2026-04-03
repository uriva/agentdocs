"use client";

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
import { CreateIdentityDialog } from "./create-identity-dialog";

interface IdentitySwitcherProps {
  identities: StoredIdentity[];
  active: StoredIdentity | null;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => Promise<StoredIdentity>;
}

export function IdentitySwitcher({
  identities,
  active,
  onSwitch,
  onCreate,
}: IdentitySwitcherProps) {
  if (!active) {
    return (
      <CreateIdentityDialog
        onCreateIdentity={onCreate}
        trigger={
          <Button size="sm" className="h-8 px-3 text-xs">
            Create Identity
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-2.5 font-mono text-xs"
            />
          }
        >
          <span
            className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
            aria-hidden
          />
          <span className="max-w-[120px] truncate">{active.name}</span>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] px-1.5 py-0"
          >
            {fingerprint(active.keyPair.signing.publicKey)}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Identities
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {identities.map((identity) => (
            <DropdownMenuItem
              key={identity.id}
              onClick={() => onSwitch(identity.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  identity.id === active.id
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30"
                }`}
              />
              <span className="flex-1 truncate text-sm">{identity.name}</span>
              <code className="text-[10px] font-mono text-muted-foreground">
                {fingerprint(identity.keyPair.signing.publicKey)}
              </code>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <CreateIdentityDialog
            onCreateIdentity={onCreate}
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer text-sm text-muted-foreground"
              >
                + New Identity
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
