import { Hero, Ticker } from "@/components/site/hero";
import { MenuSection } from "@/components/site/menu-grid";
import { OrderSection } from "@/components/order/order-section";
import { ChatWidget } from "@/components/chat/chat-widget";
import { SiteNav } from "@/components/site/site-nav";
import { MobileOrderBar, SiteFooter } from "@/components/site/site-footer";
import { getMenu } from "@/lib/menu";
import { getOrderOptions } from "@/lib/order-options";

export default async function Home() {
  const [menu, options] = await Promise.all([getMenu(), getOrderOptions()]);
  const fromPrice = menu.length ? Math.min(...menu.map((item) => item.unit_price)) : null;

  return (
    <div className="site-shell">
      <SiteNav />
      <main id="main">
        <Hero />
        <Ticker fromPrice={fromPrice} />
        <MenuSection items={menu} />
        <OrderSection menu={menu} options={options} />
      </main>
      <SiteFooter />
      <MobileOrderBar />
      <ChatWidget />
    </div>
  );
}
