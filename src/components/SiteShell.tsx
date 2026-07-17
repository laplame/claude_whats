import type { ReactNode } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

type SiteShellProps = {
  current?: string;
  children: ReactNode;
};

export default function SiteShell({ current, children }: SiteShellProps) {
  return (
    <div className="landing flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#e8efe9] text-[#132018]">
      <div className="landing-bg pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <SiteHeader current={current} />
      <main className="relative z-10 flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
