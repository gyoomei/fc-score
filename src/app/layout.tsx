import "@/app/globals.css";
import { ThemeClient } from "@/components/theme-client";
import { ProvidersAndInitialization } from "@/features/app/providers-and-initialization";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeClient />
      </head>
      <body className="font-monograph-uploaded antialiased" data-font="monograph-uploaded">
        <ProvidersAndInitialization>{children}</ProvidersAndInitialization>
      </body>
    </html>
  );
}
