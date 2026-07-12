"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginForm() {
  const [state, formAction] = useActionState(login, { error: "" });

  return (
    <form action={formAction} className="stack">
      <label htmlFor="passphrase">Passphrase</label>
      <input id="passphrase" name="passphrase" type="password" autoFocus required />
      {state?.error && <p className="muted" style={{ color: "var(--danger)" }}>{state.error}</p>}
      <button type="submit" className="btn primary">Sign in</button>
    </form>
  );
}
