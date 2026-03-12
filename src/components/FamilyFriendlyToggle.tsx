import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface FamilyFriendlyToggleProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

const AGE_QUESTIONS = [
  { question: "What year were you born?", validate: (val: string) => {
    const year = parseInt(val);
    const age = new Date().getFullYear() - year;
    return age >= 18 && age <= 120;
  }},
  { question: "What is your current age?", validate: (val: string) => {
    const age = parseInt(val);
    return age >= 18 && age <= 120;
  }},
  { question: "In what year did you turn 18?", validate: (val: string) => {
    const year = parseInt(val);
    const currentYear = new Date().getFullYear();
    return year >= 1920 && year <= currentYear;
  }},
];

const FamilyFriendlyToggle = ({ id, checked, onCheckedChange, className }: FamilyFriendlyToggleProps) => {
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [ageAnswer, setAgeAnswer] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [ageQuestion] = useState(() => AGE_QUESTIONS[Math.floor(Math.random() * AGE_QUESTIONS.length)]);
  const { toast } = useToast();

  const hasPassword = !!localStorage.getItem("ff_password");

  const handleToggleAttempt = (newVal: boolean) => {
    // Turning ON family friendly is always allowed
    if (newVal === true) {
      onCheckedChange(true);
      return;
    }

    // Turning OFF (viewing unfriendly content) requires verification
    if (hasPassword) {
      setShowPasswordPrompt(true);
    } else {
      setShowAgeGate(true);
    }
  };

  const handleAgeSubmit = () => {
    if (ageQuestion.validate(ageAnswer)) {
      onCheckedChange(false);
      setShowAgeGate(false);
      setAgeAnswer("");
      toast({ title: "Age verified", description: "Unfiltered content is now visible." });
    } else {
      toast({ title: "Access denied", description: "You must be 18 or older to view unfiltered content.", variant: "destructive" });
      setAgeAnswer("");
    }
  };

  const handlePasswordSubmit = () => {
    const stored = localStorage.getItem("ff_password");
    if (passwordInput === stored) {
      onCheckedChange(false);
      setShowPasswordPrompt(false);
      setPasswordInput("");
    } else {
      toast({ title: "Incorrect password", description: "The parental control password is wrong.", variant: "destructive" });
      setPasswordInput("");
    }
  };

  return (
    <>
      <div className={className}>
        <Switch id={id} checked={checked} onCheckedChange={handleToggleAttempt} />
        <Label htmlFor={id} className="flex items-center gap-1 text-sm font-semibold cursor-pointer whitespace-nowrap text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {checked ? "Family Friendly" : "Unfriendly"}
          {hasPassword && checked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
      </div>

      {/* Age Gate Dialog */}
      <Dialog open={showAgeGate} onOpenChange={setShowAgeGate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Age Verification</DialogTitle>
            <DialogDescription>
              You must be 18 or older to view unfiltered content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{ageQuestion.question}</Label>
            <Input
              type="number"
              value={ageAnswer}
              onChange={(e) => setAgeAnswer(e.target.value)}
              placeholder="Enter your answer"
              onKeyDown={(e) => e.key === "Enter" && handleAgeSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAgeGate(false); setAgeAnswer(""); }}>Cancel</Button>
            <Button onClick={handleAgeSubmit} disabled={!ageAnswer}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordPrompt} onOpenChange={setShowPasswordPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Parental Control</DialogTitle>
            <DialogDescription>
              Enter the parental control password to disable the family filter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Password</Label>
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordPrompt(false); setPasswordInput(""); }}>Cancel</Button>
            <Button onClick={handlePasswordSubmit} disabled={!passwordInput}>Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FamilyFriendlyToggle;
