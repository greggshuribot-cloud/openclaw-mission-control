import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell founderEmail={user.email} />;
}
