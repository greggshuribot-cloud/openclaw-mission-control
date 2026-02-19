import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function parseEnvUnits(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export default async function Home() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const treasuryDefaults = {
    monthlyCapUnits: parseEnvUnits(process.env.MONTHLY_CAP_UNITS),
    currentUsedUnits: parseEnvUnits(process.env.CURRENT_USED_UNITS),
  };

  return <AppShell founderEmail={user.email} treasuryDefaults={treasuryDefaults} />;
}
