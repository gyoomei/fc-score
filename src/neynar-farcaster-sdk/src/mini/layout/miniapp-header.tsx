"use client";

import { useFarcasterUser } from "../app/farcaster-app-atoms";
import { Avatar, AvatarFallback, AvatarImage, cn, H1 } from "@neynar/ui";
import Image from "next/image";

interface MiniappHeaderProps {
  title: string;
  variant?: "fixed" | "static";
}

export function MiniappHeader({
  title,
  variant = "fixed",
}: MiniappHeaderProps) {
  const farcasterUser = useFarcasterUser();

  return (
    <>
      <header
        className={cn(
          "flex gap-4 items-center justify-between px-4 py-3 bg-black/20 border-b border-border text-card-foreground",
          variant === "fixed" &&
            "fixed top-0 left-0 right-0 z-10 backdrop-blur-md",
        )}
      >
        <Image
          src="/app-logo-v3.png?v=logo20260502"
          alt="Base Score logo"
          width={32}
          height={32}
          className="rounded-full flex-shrink-0 border border-amber-300/30 shadow-[0_0_18px_rgba(245,158,11,0.28)]"
        />
        <H1 variant="eyebrow" truncate className="flex-1">
          {title}
        </H1>

        {farcasterUser.data ? (
          <Avatar className="size-8">
            <AvatarImage
              src={farcasterUser.data.pfpUrl}
              alt={farcasterUser.data.displayName}
            />
            <AvatarFallback className="text-xs">
              {farcasterUser.data.displayName?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">G</AvatarFallback>
          </Avatar>
        )}
      </header>
    </>
  );
}
