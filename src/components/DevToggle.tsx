import { useNavigate } from "react-router-dom";
import { Bug } from "lucide-react";

const isLovablePreview = window.location.hostname.includes('lovable.app') || window.location.hostname === 'localhost';

const DevToggle = () => {
  const navigate = useNavigate();

  if (!isLovablePreview) return null;

  return (
    <button
      onClick={() => navigate("/auth")}
      className="fixed top-4 right-4 z-[100] flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-lg hover:bg-muted transition-colors"
    >
      <Bug className="h-3.5 w-3.5" />
      Show Login
    </button>
  );
};

export default DevToggle;
