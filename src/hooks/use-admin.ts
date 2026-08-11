import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin session backed by Lovable Cloud auth.
 *
 * `isAdmin` is true only when there is a real signed-in user that carries the
 * `admin` role in the database — the browser cannot fake it, and every write
 * to clients / agendamentos / financeiro / agenda interna is enforced by
 * row-level security on the server.
 */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function resolve(userId: string | undefined) {
      if (!userId) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (active) {
        setIsAdmin(!!data);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void resolve(data.session?.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      setLoading(true);
      void resolve(session?.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }, []);

  return { isAdmin, loading, signIn, signUp, logout };
}
