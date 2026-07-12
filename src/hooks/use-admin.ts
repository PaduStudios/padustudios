import { useEffect, useState, useCallback } from "react";

const CREDS_KEY = "padu:admin:creds";
const SESSION_KEY = "padu:admin:session";

async function hash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Creds = { username: string; passwordHash: string };

function readCreds(): Creds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? (JSON.parse(raw) as Creds) : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(SESSION_KEY) === "1"
      : false
  );
  const [hasCreds, setHasCreds] = useState<boolean>(() =>
    typeof window !== "undefined" ? !!readCreds() : false
  );

  useEffect(() => {
    const sync = () => {
      setIsAdmin(localStorage.getItem(SESSION_KEY) === "1");
      setHasCreds(!!readCreds());
    };
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setup = useCallback(
    async (username: string, password: string) => {
      const passwordHash = await hash(password);
      localStorage.setItem(
        CREDS_KEY,
        JSON.stringify({ username, passwordHash } satisfies Creds)
      );
      localStorage.setItem(SESSION_KEY, "1");
      notify();
    },
    []
  );

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const creds = readCreds();
      if (!creds) return false;
      const passwordHash = await hash(password);
      if (creds.username === username && creds.passwordHash === passwordHash) {
        localStorage.setItem(SESSION_KEY, "1");
        notify();
        return true;
      }
      return false;
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    notify();
  }, []);

  return { isAdmin, hasCreds, setup, login, logout };
}
