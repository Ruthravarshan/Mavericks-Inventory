import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Building2,
  MapPin,
  Shield,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Tag,
  Hash,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  valueClassName?: string;
}

function InfoRow({ icon: Icon, label, value, valueClassName }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[hsl(var(--border))] last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))]">
        <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          {label}
        </div>
        <div className={cn("mt-0.5 text-sm font-medium text-[hsl(var(--foreground))]", valueClassName)}>
          {value ?? (
            <span className="text-[hsl(var(--muted-foreground))] font-normal italic">Not set</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      reset();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to change password. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p: string) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const userRole = user?.role ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/20 text-xl font-bold text-[hsl(var(--primary))]">
                {initials}
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-[hsl(var(--foreground))]">
                  {user?.name ?? "—"}
                </CardTitle>
                <p className="mt-0.5 text-sm text-[hsl(var(--muted-foreground))]">
                  {user?.email}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary))]/15 px-2.5 py-1 text-xs font-medium text-[hsl(var(--primary))]">
                  <Shield className="h-3 w-3" />
                  {ROLE_LABELS[userRole] ?? userRole}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[hsl(var(--border))]">
              <InfoRow
                icon={User}
                label="Full Name"
                value={user?.name}
              />
              <InfoRow
                icon={Mail}
                label="Email Address"
                value={user?.email}
              />
              <InfoRow
                icon={Hash}
                label="Employee ID"
                value={user?.employee_id}
              />
              <InfoRow
                icon={Building2}
                label="Department"
                value={user?.department}
              />
              <InfoRow
                icon={Tag}
                label="Role"
                value={ROLE_LABELS[userRole] ?? userRole}
              />
              <InfoRow
                icon={MapPin}
                label="Location"
                value={user?.location}
              />
              <InfoRow
                icon={Calendar}
                label="Member Since"
                value={user?.created_at ? formatDate(user.created_at) : undefined}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change password card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/15">
                <Lock className="h-4 w-4 text-[hsl(var(--primary))]" />
              </div>
              <CardTitle className="text-base font-semibold text-[hsl(var(--foreground))]">
                Change Password
              </CardTitle>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Update your account password. Minimum 8 characters required.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Current password */}
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword" className="text-sm font-medium">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter current password"
                    className={cn(
                      "pr-10",
                      errors.currentPassword && "border-red-500 focus-visible:ring-red-500"
                    )}
                    {...register("currentPassword")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-xs text-red-400">{errors.currentPassword.message}</p>
                )}
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    placeholder="Enter new password (min. 8 chars)"
                    className={cn(
                      "pr-10",
                      errors.newPassword && "border-red-500 focus-visible:ring-red-500"
                    )}
                    {...register("newPassword")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-xs text-red-400">{errors.newPassword.message}</p>
                )}
              </div>

              {/* Confirm new password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter new password"
                    className={cn(
                      "pr-10",
                      errors.confirmPassword && "border-red-500 focus-visible:ring-red-500"
                    )}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  <Lock className="h-4 w-4" />
                  {isSubmitting ? "Updating…" : "Update Password"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => reset()}
                  disabled={isSubmitting}
                  className="text-[hsl(var(--muted-foreground))]"
                >
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
