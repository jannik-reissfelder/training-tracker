import { prisma } from "@/lib/db";
import SettingsForm from "@/components/settings-form";

export default async function SettingsPage() {
  const config = await prisma.config.findUnique({ where: { id: "default" } });

  return (
    <div className="stack" style={{ maxWidth: "32rem" }}>
      <h1>Settings</h1>
      <SettingsForm config={config} />
    </div>
  );
}
