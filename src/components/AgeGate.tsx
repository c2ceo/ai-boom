import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

const AGE_VERIFIED_KEY = "aiboom_age_verified";

const AgeGate = ({ children }: { children: React.ReactNode }) => {
  const [verified, setVerified] = useState(() => {
    return localStorage.getItem(AGE_VERIFIED_KEY) === "true";
  });
  const [birthYear, setBirthYear] = useState("");
  const [error, setError] = useState("");

  const handleVerify = () => {
    const year = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1900 || year > currentYear) {
      setError("Please enter a valid birth year.");
      return;
    }
    const age = currentYear - year;
    if (age < 13) {
      setError("You must be at least 13 years old to use AI-BOOM.");
      return;
    }
    localStorage.setItem(AGE_VERIFIED_KEY, "true");
    setVerified(true);
  };

  if (verified) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Age Verification</h1>
        <p className="text-sm text-muted-foreground">
          AI-BOOM requires users to be at least 13 years old. Please enter your birth year to continue.
        </p>
        <div className="space-y-2 text-left">
          <Label>Birth Year</Label>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(e) => { setBirthYear(e.target.value.replace(/\D/g, "")); setError(""); }}
            placeholder="e.g. 2005"
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button className="w-full" onClick={handleVerify}>
          Continue
        </Button>
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-primary underline">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default AgeGate;
