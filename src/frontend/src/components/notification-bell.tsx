import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetNotifications, useMarkAllRead } from "@/hooks/use-queries";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications = [] } = useGetNotifications();
  const markAllRead = useMarkAllRead();

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const recent = notifications.slice(0, 10);

  function handleClick(link: string | null) {
    if (link) navigate(link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <motion.span
            animate={unreadCount > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : { rotate: 0 }}
            transition={{ duration: 0.8, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 5 }}
            className="inline-flex"
          >
            <Bell className="h-5 w-5" />
          </motion.span>
          {unreadCount > 0 && (
            <>
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm shadow-red-500/40"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 animate-ping rounded-full bg-red-500/40" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-[hsl(var(--primary))] hover:underline"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <div className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No notifications
          </div>
        ) : (
          recent.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleClick(n.link)}
              className={cn(
                "flex flex-col items-start gap-1 py-3 cursor-pointer",
                !n.is_read && "bg-[hsl(var(--primary))]/5"
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className={cn("text-sm font-medium", !n.is_read && "text-[hsl(var(--primary))]")}>
                  {n.title}
                </span>
                {!n.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                )}
              </div>
              <span className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
                {n.message}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatRelativeTime(n.created_at)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
