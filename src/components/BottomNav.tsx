import { Home, Search, PlusSquare, Bell, User, ShieldAlert } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/explore", icon: Search, label: "Explore" },
  { to: "/create", icon: PlusSquare, label: "Create" },
  { to: "/vote", icon: ShieldAlert, label: "Vote" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <Icon className="h-6 w-6" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
