import { EventManifest } from "../../sdk/swsdk/manifests/events.js";

export const eventManifest: EventManifest = {
  schemaVersion: "1.0",
  workspaceId: "sales.invoice",
  eventsEmitted: [
    { eventType: "sales.invoice.created", payloadType: "Record<string, unknown>", description: "Fired when SalesInvoice is created" }
  ],
  eventsSubscribed: ["company.changed", "theme.changed"]
};
