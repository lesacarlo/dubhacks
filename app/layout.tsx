import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "First Trip | Gear with a reason", description: "An explained first backpacking purchase plan." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
