import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  X,
  Package,
  Camera,
  CheckCircle2,
  XCircle,
  Gift,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/types";

function getNotificationIcon(type: string) {
  switch (type) {
    case "asset_request":
      return Package;
    case "audit_needs_review":
      return Camera;
    case "request_approved":
      return CheckCircle2;
    case "request_rejected":
      return XCircle;
    case "request_fulfilled":
      return Gift;
    case "audit_reviewed":
      return CheckCircle2;
    default:
      return Bell;
  }
}

function getNotificationIconColor(type: string): string {
  switch (type) {
    case "asset_request":
      return "text-blue-400";
    case "audit_needs_review":
      return "text-amber-400";
    case "request_approved":
      return "text-emerald-400";
    case "request_rejected":
      return "text-red-400";
    case "request_fulfilled":
      return "text-purple-400";
    case "audit_reviewed":
      return "text-teal-400";
    default:
      return "text-[hsl(var(--muted-foreground))]";
  }
}

function NotificationSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const Icon = getNotificationIcon(notification.type);
  const iconColor = getNotificationIconColor(notification.type);

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--secondary))]/50",
        !notification.is_read && "bg-[hsl(var(--primary))]/5"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          !notification.is_read
            ? "bg-[hsl(var(--primary))]/15"
            : "bg-[hsl(var(--secondary))]"
        )}
      >
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium leading-tight",
              notification.is_read
                ? "text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--primary))]"
            )}
          >
            {notification.title}
          </span>
          {!notification.is_read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--primary))]" />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
          {notification.message}
        </p>
        <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]/70">
          {formatRelativeTime(notification.created_at)}
        </span>
      </div>
    </div>
  );
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS,
    queryFn: () => notificationsApi.list().then((r) => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Bell trigger button */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Open notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Slide-in panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl sm:w-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[hsl(var(--foreground))]" />
                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="text-xs text-[hsl(var(--primary))] hover:underline disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <>
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                  <NotificationSkeleton />
                </>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
                    <Bell className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      All caught up
                    </p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      No notifications yet
                    </p>
                  </div>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem key={n.id} notification={n} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
