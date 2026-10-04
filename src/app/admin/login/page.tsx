import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="page narrow">
      <section className="hero login-hero">
        <p className="hero-label">Contribution Circle</p>
        <h1 className="hero-name">Admin sign in</h1>
        <p className="hero-expected">For the finance person only.</p>
      </section>
      <div className="card">
        <LoginForm />
      </div>
    </main>
  );
}
