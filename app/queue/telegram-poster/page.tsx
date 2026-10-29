import type { Metadata } from "next";
import { TelegramPoster } from "@/components/queue/patient-screens";

export const metadata: Metadata = { title: "Telegram Reminders Poster · THSC Queue Board", description: "Printable QR code of the clinic's Telegram bot for queue reminders." };

export default function TelegramPosterPage() {
  return <TelegramPoster />;
}
