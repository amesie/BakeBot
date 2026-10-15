// Owner and helper dashboard (M5 / Phase 4). proxy.ts sends signed-out
// visitors to the login page; here we also check the staff role, because a
// valid login is not enough (D-003, D-016).
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { ApprovalQueue, BatchPanel, PaymentsPanel, SettingsPanel } from "@/components/dashboard/panels";
import {
  getCollectionPlace,
  getFeedback,
  getOrders,
  getOwnerUpdates,
  getRecentlyPaid,
  getSettings,
  getStaff,
  type StaffRole,
} from "@/lib/dashboard/data";
import { DeletionRequest, FeedbackPanel, OwnerUpdates, ReleasedOrders } from "@/components/dashboard/updates";

export const metadata: Metadata = {
  title: "Dashboard · KD Pops",
  robots: { index: false, follow: false },
};

type Tab = "orders" | "payments" | "batch" | "feedback" | "settings";

const TABS: { id: Tab; label: string; roles: StaffRole[] }[] = [
  { id: "orders", label: "Approve", roles: ["owner"] },
  { id: "payments", label: "Payments", roles: ["owner", "helper"] },
  { id: "batch", label: "Batch", roles: ["owner", "helper"] },
  { id: "feedback", label: "Feedback", roles: ["owner"] },
  { id: "settings", label: "Settings", roles: ["owner"] },
];

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string }>;
}) {
  return (
    <main className="min-h-screen" style={{ background: "var(--ivory)" }}>
      <Suspense fallback={<p className="container-kd py-10">Loading...</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string }> }) {
  const staff = await getStaff();
  if (!staff.signedIn) redirect("/auth/login");

  if (!staff.role) {
    return (
      <div className="container-kd py-16 stack" style={{ maxWidth: 520 }}>
        <h1 className="font-display text-3xl">Not a staff account</h1>
        <p>
          You are signed in as {staff.email}, but this account has not been given access to the KD Pops dashboard.
          Ask Kaydee to add you.
        </p>
        <LogoutButton />
      </div>
    );
  }

  const role = staff.role;
  const params = await searchParams;
  const allowed = TABS.filter((t) => t.roles.includes(role));
  const tab = allowed.find((t) => t.id === params.tab)?.id ?? allowed[0].id;

  return (
    <>
      <header className="nav-wrap">
        <div className="container-kd" style={{ paddingBlock: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <Link className="wordmark" href="/">
                KD <span>POPS</span>
              </Link>
              <p className="form-note m-0">
                {staff.name ?? staff.email} · {role === "owner" ? "Owner" : "Helper"}
              </p>
            </div>
            <LogoutButton />
          </div>
          <nav className="choice-row" style={{ marginTop: 12 }} aria-label="Dashboard sections">
            {allowed.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?tab=${t.id}`}
                className={`pill pill-small ${t.id === tab ? "" : "pill-outline"}`}
                aria-current={t.id === tab ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="container-kd" style={{ paddingBlock: 28, maxWidth: 820 }}>
        <TabContent tab={tab} role={role} week={params.week ?? null} />
      </div>
    </>
  );
}

async function TabContent({ tab, role, week }: { tab: Tab; role: StaffRole; week: string | null }) {
  if (tab === "orders") {
    const [orders, updates] = await Promise.all([getOrders(["pending", "waitlisted"]), getOwnerUpdates()]);
    return (
      <div className="stack" style={{ gap: 24 }}>
        <OwnerUpdates updates={updates} />
        <ApprovalQueue orders={orders} />
      </div>
    );
  }

  if (tab === "payments") {
    const [active, paid, place] = await Promise.all([
      getOrders(["confirmed", "baking", "ready", "collected"]),
      getRecentlyPaid(),
      getCollectionPlace(),
    ]);
    // Released orders (REQ-20) leave the payment and collection lists.
    const live = active.filter((o) => !o.released_at);
    const unpaid = live.filter((o) => o.payments && o.payments.payment_status !== "paid");
    const ready = live.filter((o) => o.order_status === "ready");
    const released = active.filter((o) => o.released_at && o.order_status !== "collected");
    return (
      <div className="stack" style={{ gap: 28 }}>
        <PaymentsPanel unpaid={unpaid} ready={ready} paid={paid} role={role} place={place} />
        <ReleasedOrders orders={released} />
      </div>
    );
  }

  if (tab === "batch") {
    const [orders, place] = await Promise.all([getOrders(["confirmed", "baking", "ready", "collected"]), getCollectionPlace()]);
    const weeks = [...new Set(orders.map((o) => o.collection_week))].sort();
    const upcoming = weeks.find((w) => orders.some((o) => o.collection_week === w && o.order_status !== "collected"));
    const selected = week && weeks.includes(week) ? week : (upcoming ?? weeks.at(-1) ?? null);
    return <BatchPanel orders={orders} weeks={weeks} week={selected} role={role} place={place} />;
  }

  if (tab === "feedback") {
    return <FeedbackPanel feedback={await getFeedback()} />;
  }

  const { settings, caps, products } = await getSettings();
  return (
    <div className="stack" style={{ gap: 28 }}>
      <SettingsPanel settings={settings} caps={caps} products={products} />
      <DeletionRequest />
    </div>
  );
}
