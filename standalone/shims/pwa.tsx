// Stand-in for components/pwa.tsx in the single-file build: an HTML file opened from disk cannot be installed as an app.

export function RegisterServiceWorker() {
  return null;
}

export function InstallAppButton(props: { className?: string }) {
  void props;
  return null;
}
