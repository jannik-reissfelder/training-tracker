import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";

export default async function LoginPage() {
  if (await verifySession()) {
    redirect("/");
  }

  return (
    <main className="container" style={{ maxWidth: "24rem", paddingTop: "4rem" }}>
      <h1>Training Tracker</h1>
      <p className="muted">Enter the shared passphrase to continue.</p>
      <LoginForm />
    </main>
  );
}
