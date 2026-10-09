import { useMemo, useSyncExternalStore } from "react";

// Stand-in for next/navigation in the single-file build: screens live in the URL hash (#/queue/station?s=C1).

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("hashchange", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("hashchange", listener);
  };
}

function currentRoute() {
  const hash = window.location.hash.slice(1);
  return hash.startsWith("/") ? hash : "/queue";
}

export function navigate(href: string, replace = false) {
  if (!replace) {
    window.location.hash = href;
    return;
  }
  window.history.replaceState(null, "", `#${href}`);
  listeners.forEach((listener) => listener());
}

function useRoute() {
  return useSyncExternalStore(subscribe, currentRoute, () => "/queue");
}

export function usePathname() {
  return useRoute().split("?")[0];
}

export function useSearchParams() {
  const route = useRoute();
  return useMemo(() => new URLSearchParams(route.split("?")[1] ?? ""), [route]);
}

export function useRouter() {
  return useMemo(() => ({ push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true) }), []);
}
