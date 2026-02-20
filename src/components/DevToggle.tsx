import { useNavigate, useLocation } from "react-router-dom";
import { Bug } from "lucide-react";

const isLovablePreview = window.location.hostname.includes('lovable.app') || window.location.hostname === 'localhost';

const DevToggle = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isLovablePreview) return null;

  const isOnAuth = location.pathname === "/auth";

  return (
    <button
      onClick={() => navigate(isOnAuth ? "/" : "/auth")}
      className="fixed top-4 right-4 z-[100] flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
    >
      <Bug className="h-3.5 w-3.5" />
      {isOnAuth ? "Skip to Home" : "Show Login"}
    </button>
  );
};

export default DevToggle;
