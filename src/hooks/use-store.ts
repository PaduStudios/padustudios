import { useSyncExternalStore } from "react";
import { store } from "@/lib/scheduling/store";

/**
 * Subscribe to the mock store. Swap this for a Supabase realtime hook later
 * without touching components.
 */
export function useStore() {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}
