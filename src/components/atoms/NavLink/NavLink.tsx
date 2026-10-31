import { Link, type LinkProps } from "@tanstack/react-router";

export function NavLink(props: LinkProps) {
  return <Link activeProps={{ className: "active" }} {...props} />;
}
