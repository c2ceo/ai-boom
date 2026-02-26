import { useEffect, useState } from "react";
import { Home, Search, PlusSquare, Bell, User, ShieldAlert } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/explore", icon: Search, label: "Explore" },
  { to: "/create", icon: PlusSquare, label: "Create" },
  { to: "/vote", icon: ShieldAlert, label: "Vote" },
  { to: "/notifications", icon: Bell, label: "Alerts", showBadge: true },
  { to: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }

    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel("notif-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {navItems.map(({ to, icon: Icon, label, showBadge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground transition-colors"
            activeClassName="text-primary"
          >
            <div className="relative">
              <Icon className="h-6 w-6" />
              {showBadge && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
