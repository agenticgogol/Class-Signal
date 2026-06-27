import type { Metadata } from "next";
import { QuestionsModule } from "@/components/questions-module";

export const metadata: Metadata = { title: "Public questions" };

export default function QuestionsPage() {
  return <QuestionsModule />;
}
