import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="page">
      <nav className="tabs">
        <Link href="/admin">Round</Link>
        <Link href="/admin/members">Members</Link>
        <Link href="/admin/settings">Settings</Link>
      </nav>
      {children}
      <footer className="foot">
        <Link href="/" target="_blank">Public page</Link>
        <form action={logout}>
          <button className="linkbtn">Log out</button>
        </form>
      </footer>
    </div>
  );
}
