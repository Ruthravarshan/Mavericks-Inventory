import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 text-8xl font-bold text-[hsl(var(--primary))]/20">404</div>
      <h1 className="text-2xl font-bold">Page Not Found</h1>
      <p className="mt-2 max-w-sm text-[hsl(var(--muted-foreground))]">
        The page you're looking for doesn't exist or you don't have permission to access it.
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
        <Button onClick={() => navigate("/dashboard")}>
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
