import React from "react";

const channels = [
  { title: "Retail POS", summary: "Counter sales and assisted checkout using the existing sales pipeline." },
  { title: "B2C E-Commerce", summary: "Website, cart, checkout, and channel orders routed to the same sales document flow." },
  { title: "Marketplace", summary: "Amazon, Flipkart, Meesho, Shopify, and WooCommerce connectors as adapters." },
  { title: "Social Commerce", summary: "WhatsApp, Instagram, and Facebook based order capture and sync." },
  { title: "B2B Portal", summary: "Trade and distributor-specific ordering experience backed by the same ERP foundation." },
  { title: "Wholesale", summary: "Bulk sales channels that reuse the same document, inventory, and finance lifecycle." },
];

export const EcommerceStudioTab: React.FC = () => {
  return (
    <div className="h-full w-full overflow-auto bg-[var(--sds-color-background)] text-[var(--sds-color-text-main)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl border border-[var(--sds-color-border)] bg-[var(--sds-color-surface)] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--sds-color-text-secondary)]">Commerce</p>
              <h2 className="text-2xl font-semibold">Unified Commerce Studio</h2>
            </div>
            <div className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-400">
              Omnichannel ready
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--sds-color-text-secondary)]">
            Unified commerce is treated as a channel-driven sales layer over the existing Sales, Inventory, Finance, and Workflow foundation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <div key={channel.title} className="rounded-2xl border border-[var(--sds-color-border)] bg-[var(--sds-color-surface)] p-5">
              <h3 className="text-lg font-semibold">{channel.title}</h3>
              <p className="mt-2 text-sm text-[var(--sds-color-text-secondary)]">{channel.summary}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-[var(--sds-color-border)] bg-[var(--sds-color-surface)] p-6">
          <h3 className="text-lg font-semibold">Architecture direction</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--sds-color-text-secondary)]">
            <li>• Channel adapters route into the same Sales Order → Inventory → Finance → Invoice flow.</li>
            <li>• Channel policies configure behavior per channel without changing the shared sales engine.</li>
            <li>• Marketplace and social-commerce integrations are implemented as adapters rather than separate ERP engines.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EcommerceStudioTab;
