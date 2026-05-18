import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, extraMeta?: Record<string, string>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Staff login flow: resolves email via RPC then signs in */
  signInStaff: (accessCode: string, staffId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately with the current session,
    // so getSession() is redundant and causes a double-setState race condition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, extraMeta?: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, ...extraMeta },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInStaff = async (accessCode: string, staffId: string, password: string) => {
    // Step 1: resolve email via SECURITY DEFINER RPC (safe, anon-callable)
    const { data: email, error: rpcError } = await supabase.rpc("resolve_staff_login", {
      p_access_code: accessCode,
      p_staff_id: staffId,
    });
    if (rpcError) throw new Error("Invalid credentials");
    if (!email) throw new Error("Invalid credentials");
    // Step 2: sign in with resolved email + password
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Invalid credentials");
  };

  const signOut = async () => {
    // Clear all client-side session data first so nothing leaks
    sessionStorage.clear();
    // Remove only the Supabase auth key from localStorage; other app prefs (theme) are fine
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key === "nexus_staff_session" || key === "nexus_owner_session") {
        localStorage.removeItem(key);
      }
    });
    // Sign out globally (invalidates refresh tokens on the server)
    await supabase.auth.signOut({ scope: "global" });
    // Hard redirect — unmounts React tree, clears all in-memory state including RQ cache
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInStaff, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
