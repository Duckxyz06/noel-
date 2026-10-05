import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noël — Cây thông kỷ niệm",
  description: "Tên gọi hóa ánh sáng, kỷ niệm hóa Giáng sinh. Cây thông riêng với ảnh, nhạc và những người bạn yêu thương.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
