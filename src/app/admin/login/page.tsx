import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="page narrow">
      <header className="top">
        <h1>Admin sign in</h1>
        <p className="muted">For the finance person only.</p>
      </header>
      <div className="card">
        <LoginForm />
      </div>
    </main>
  );
}
