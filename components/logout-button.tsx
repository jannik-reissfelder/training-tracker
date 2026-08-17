"use client";

import { logout } from "@/app/actions";

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="btn">Log out</button>
    </form>
  );
}
