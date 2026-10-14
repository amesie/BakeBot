import { Hero, Ticker } from "@/components/site/hero";
import { MenuSection } from "@/components/site/menu-grid";
import { OrderComingSoon } from "@/components/site/order-coming-soon";
import { SiteNav } from "@/components/site/site-nav";
import { MobileOrderBar, SiteFooter } from "@/components/site/site-footer";
import { getMenu } from "@/lib/menu";

export default async function Home() {
  const menu = await getMenu();
  const fromPrice = menu.length ? Math.min(...menu.map((item) => item.unit_price)) : null;

  return (
    <div className="site-shell">
      <SiteNav />
      <main id="main">
        <Hero />
        <Ticker fromPrice={fromPrice} />
        <MenuSection items={menu} />
        <OrderComingSoon />
      </main>
      <SiteFooter />
      <MobileOrderBar />
    </div>
  );
}
