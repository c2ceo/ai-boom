import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { initRevenueCat } from "@/lib/revenuecat";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  admitted: boolean;
  isGuest: boolean;
  refreshAdmission: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [admitted, setAdmitted] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const refreshAdmission = async () => {
    const {data:{user:current}}=await supabase.auth.getUser();
    if(!current){setAdmitted(false);setIsGuest(false);return;}
    const birthday=sessionStorage.getItem('aiboom_pending_birthday');
    if(birthday){
      const {error}=await supabase.rpc('confirm_visitor_age',{p_birthday:birthday});
      if(!error) sessionStorage.removeItem('aiboom_pending_birthday');
    }
    const {data}=await supabase.from('visitor_admissions').select('is_guest').eq('user_id',current.id).maybeSingle();
    setAdmitted(Boolean(data));setIsGuest(data?.is_guest === true);
  };

  useEffect(() => {
    // Listen first; validate persisted identity with the auth server.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        window.location.replace("/reset-password");
      }
      setSession(session);
      setUser(session?.user ?? null);
      if(!session){setAdmitted(false);setIsGuest(false);setLoading(false);}
      else setTimeout(()=>{void refreshAdmission().finally(()=>setLoading(false));},0);
      if (session?.user?.id) {
        initRevenueCat(session.user.id);
      }
    });
    supabase.auth.getUser().then(async ({data:{user}})=>{
      setUser(user);
      if(user) await refreshAdmission();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username, display_name: username },
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, admitted, isGuest, refreshAdmission, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
