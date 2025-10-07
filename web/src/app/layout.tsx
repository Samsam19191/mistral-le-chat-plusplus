// Root layout sets up the shared application shell and wraps every page with the global container.
import "./globals.css";
import type { ReactNode } from "react";
import Footer from "@/components/app-shell/Footer";
import Header from "@/components/app-shell/Header";
import Nav from "@/components/app-shell/Nav";
import { Providers } from "@/lib/react-query";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
