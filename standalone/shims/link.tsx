import type { AnchorHTMLAttributes } from "react";

/** Stand-in for next/link in the single-file build: app paths become hash links. */
export default function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={`#${href}`} {...props} />;
}
