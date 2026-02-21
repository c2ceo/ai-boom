import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import DevToggle from "@/components/DevToggle";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Create from "./pages/Create";
import CommunityVote from "./pages/CommunityVote";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Auth from "./pages/Auth";
import PostView from "./pages/PostView";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import { Sparkles } from "lucide-react";

const queryClient = new QueryClient();

const isLovablePreview = window.location.hostname.includes('lovable.app') || window.location.hostname.includes('lovableproject.com') || window.location.hostname === 'localhost';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  // Bypass auth in Lovable preview
  if (isLovablePreview) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Sparkles className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background">
    <div className="fixed top-3 right-3 z-50">
      <ThemeToggle />
    </div>
    {children}
    <BottomNav />
  </div>
);

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Sparkles className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user && !isLovablePreview ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />
      <Route path="/explore" element={<ProtectedRoute><AppLayout><Explore /></AppLayout></ProtectedRoute>} />
      <Route path="/create" element={<ProtectedRoute><AppLayout><Create /></AppLayout></ProtectedRoute>} />
      <Route path="/vote" element={<ProtectedRoute><AppLayout><CommunityVote /></AppLayout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AppLayout><Notifications /></AppLayout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
      <Route path="/edit-profile" element={<ProtectedRoute><AppLayout><EditProfile /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="/privacy" element={<ProtectedRoute><AppLayout><Privacy /></AppLayout></ProtectedRoute>} />
      <Route path="/post/:postId" element={<ProtectedRoute><AppLayout><PostView /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <DevToggle />
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
