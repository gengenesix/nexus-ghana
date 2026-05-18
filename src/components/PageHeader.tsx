import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** If provided, renders a back-arrow that navigates here or -1 if true */
  back?: string | true;
  actions?: React.ReactNode;
}

/**
 * Standardised page header used across all module pages.
 * Keeps title hierarchy and action alignment consistent.
 */
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (back === true) navigate(-1);
    else if (typeof back === "string") navigate(back);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-start gap-2">
        {back !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 -ml-2"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 sm:shrink-0">{actions}</div>
      )}
    </div>
  );
}
