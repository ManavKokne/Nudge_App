"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useThemeStore } from "@/stores/theme-store";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";

function buildFallback(email) {
  if (!email) {
    return "NU";
  }

  const parts = email.split("@")[0]?.split(/[._-]/).filter(Boolean) || [];

  if (parts.length === 0) {
    return email.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TopNavbar({ user, onUserUpdate }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localUser, setLocalUser] = useState(user);

  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const fallback = useMemo(() => buildFallback(localUser?.email), [localUser?.email]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    window.location.href = "/login";
  }

  function handleProfileUpdated(nextUser) {
    setLocalUser(nextUser);
    onUserUpdate?.(nextUser);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/home" className="flex items-center gap-3">
          <Image
            src="/PT_Logo.png"
            alt="Nudge logo"
            width={152}
            height={42}
            className="hidden h-10 w-auto lg:block"
            priority
          />
          <Image
            src="/PT_Logo_SM_MD.png"
            alt="Nudge compact logo"
            width={96}
            height={38}
            className="h-8 w-auto lg:hidden"
            priority
          />
        </Link>

        <div className="hidden items-center gap-2 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full border border-[var(--border)] p-1 transition hover:border-[var(--accent)]/50">
                <Avatar>
                  <AvatarImage src={localUser?.avatarUrl || "/avatar/av_1.png"} alt={localUser?.email || "avatar"} />
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="space-y-1">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Signed in as</p>
                <p className="truncate text-sm font-semibold">{localUser?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsProfileOpen(true)}>
                <UserRound className="mr-2 h-4 w-4" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(event) => event.preventDefault()} className="justify-between">
                <span className="flex items-center">
                  {theme === "dark" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                  Theme
                </span>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="text-[var(--danger)] focus:text-[var(--danger)]">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="lg:hidden">
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogTrigger asChild>
              <button className="rounded-full border border-[var(--border)] p-1">
                <Avatar>
                  <AvatarImage src={localUser?.avatarUrl || "/avatar/av_1.png"} alt={localUser?.email || "avatar"} />
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
              </button>
            </DialogTrigger>
            <DialogContent className="left-auto right-0 top-0 flex h-screen w-[85vw] max-w-sm translate-x-0 translate-y-0 flex-col rounded-none border-l border-[var(--border)] p-6">
              <DialogHeader>
                <DialogTitle>Account</DialogTitle>
                <DialogDescription>{localUser?.email}</DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="space-y-3">
                  <Button variant="secondary" className="w-full justify-start" onClick={() => setIsProfileOpen(true)}>
                    <UserRound className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>

                  <div className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3">
                    <span className="text-sm font-medium">Dark mode</span>
                    <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
                  </div>
                </div>

                <div className="mt-auto space-y-3 pb-1">
                  <Button variant="ghost" className="w-full justify-start text-[var(--danger)]" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-3 text-xs text-[var(--muted)]">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-[var(--text)]">
                      <Settings className="h-3.5 w-3.5" />
                      Quick note
                    </div>
                    Theme preference is persisted globally and applies across all pages.
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <EditProfileDialog
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        user={localUser}
        onUpdated={handleProfileUpdated}
      />
    </header>
  );
}
