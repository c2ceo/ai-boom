import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, LogOut, Shield, Bell, HelpCircle } from "lucide-react";

const Settings = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const items = [
    { icon: User, label: "Edit Profile", onClick: () => navigate("/edit-profile") },
    { icon: Bell, label: "Notifications", onClick: () => navigate("/notifications") },
    { icon: Shield, label: "Privacy", onClick: () => navigate("/privacy") },
    { icon: HelpCircle, label: "Help & Support", onClick: () => window.location.href = "mailto:gregcampbellc2c@icloud.com" },
  ];

  return (
    <div className="min-h-screen pb-20 pt-4 px-4 text-foreground">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="space-y-1">
        {items.map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8 border-t border-border pt-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Settings;
