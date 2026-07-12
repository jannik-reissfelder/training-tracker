import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await verifySession())) {
    redirect("/login");
  }

  return (
    <div className="container">
      <nav className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1rem" }}>
        <div className="row">
          <Link href="/" className="btn">Dashboard</Link>
          <Link href="/workouts" className="btn">Workouts</Link>
          <Link href="/exercises" className="btn">Exercises</Link>
          <Link href="/stats" className="btn">Stats</Link>
          <Link href="/settings" className="btn">Settings</Link>
        </div>
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
