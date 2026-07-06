import type { Metadata } from "next";

import { AdminClasswiseAgendaManager } from "@/components/admin-classwise-agenda-manager";
import { getAgendaEntries } from "@/lib/classwise-agenda/admin";

export const metadata: Metadata = { title: "Classwise Agenda" };

export default async function ClasswiseAgendaPage() {
  const { entries, migrationRequired } = await getAgendaEntries();
  return <section className="admin-page"><AdminClasswiseAgendaManager initialEntries={entries} migrationRequired={migrationRequired} /></section>;
}
