import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, LogOut, Shield, Bell, HelpCircle, Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const hasPassword = !!localStorage.getItem("ff_password");

  const handleSavePassword = () => {
    if (!newPassword) {
      toast({ title: "Password required", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 4) {
      toast({ title: "Password must be at least 4 characters", variant: "destructive" });
      return;
    }
    localStorage.setItem("ff_password", newPassword);
    setShowPasswordSetup(false);
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Parental password set", description: "The family filter now requires a password to disable." });
  };

  const handleRemovePassword = () => {
    localStorage.removeItem("ff_password");
    setShowPasswordSetup(false);
    toast({ title: "Parental password removed" });
  };

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
          onClick={() => setShowSignOutDialog(true)}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>

      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Do you wish to sign out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
