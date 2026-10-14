import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderStatus } from "@/components/order/order-status";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

// Private per-order page: keep it out of search engines and never send the
// address on to other sites.
export const metadata: Metadata = {
  title: "Your order · KD Pops",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OrderStatusPage() {
  return (
    <div className="site-shell">
      <SiteNav />
      <Suspense fallback={<main id="main" className="order-section" style={{ minHeight: "70vh" }} />}>
        <OrderStatus />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
