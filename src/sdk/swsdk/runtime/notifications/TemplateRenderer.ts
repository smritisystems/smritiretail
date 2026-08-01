import type { NotificationEnvelope } from "./NotificationEnvelope.js";
import type { NotificationTemplate } from "./NotificationRegistry.js";

export class TemplateRenderer {
  public render(template: NotificationTemplate, envelope: NotificationEnvelope): { subject: string; body: string } {
    const payload = envelope.payload as Record<string, unknown>;
    const interpolate = (value: string): string => value.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
      const resolved = payload[key.trim()];
      return resolved == null ? "" : String(resolved);
    });

    return {
      subject: interpolate(template.subject),
      body: interpolate(template.body)
    };
  }
}
