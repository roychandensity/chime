"use client";

import { useRouter, usePathname } from "next/navigation";
import { FilterProvider } from "@/contexts/filter-context";
import ExportButton from "@/components/export-button";

const TABS = [
  { href: "/dashboard/saturation", label: "Saturation" },
  { href: "/dashboard/meeting-rooms", label: "Meeting Rooms" },
  { href: "/dashboard/desk-usage", label: "Desk Usage" },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <FilterProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">Chime</h1>
            <div className="flex items-center gap-3">
              <ExportButton />
              <button
                onClick={handleLogout}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex gap-0 -mb-px">
              {TABS.map((tab) => {
                const active = pathname === tab.href || (tab.href === "/dashboard/saturation" && pathname === "/dashboard");
                return (
                  <button
                    key={tab.href}
                    onClick={() => router.push(tab.href)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      active
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </div>
    </FilterProvider>
  );
}
