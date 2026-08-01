import type { NotificationDefinition } from "./NotificationDefinition.js";

export interface NotificationTemplate {
  id: string;
  name: string;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
}

export interface NotificationBinding {
  eventType: string;
  templateId: string;
  context: Record<string, unknown>;
}

export class NotificationRegistry {
  private static instance: NotificationRegistry;
  private templates = new Map<string, NotificationTemplate>();
  private bindings = new Map<string, NotificationBinding>();
  private definitions = new Map<string, NotificationDefinition>();
  private channels = new Set<string>();

  public static getInstance(): NotificationRegistry {
    if (!NotificationRegistry.instance) {
      NotificationRegistry.instance = new NotificationRegistry();
    }
    return NotificationRegistry.instance;
  }

  public registerDefinition(definition: NotificationDefinition): NotificationDefinition {
    this.definitions.set(definition.id, definition);
    return definition;
  }

  public registerChannel(channel: string): void {
    this.channels.add(channel);
  }

  public registerTemplate(template: NotificationTemplate): NotificationTemplate {
    this.templates.set(template.id, template);
    return template;
  }

  public resolveDefinition(definitionId: string): NotificationDefinition | undefined {
    return this.definitions.get(definitionId);
  }

  public resolveTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  public bind(binding: NotificationBinding): NotificationBinding {
    this.bindings.set(`${binding.eventType}:${binding.templateId}`, binding);
    return binding;
  }

  public resolveBinding(eventType: string, templateId: string): NotificationBinding | undefined {
    return this.bindings.get(`${eventType}:${templateId}`);
  }

  public listBindings(): NotificationBinding[] {
    return Array.from(this.bindings.values());
  }

  public isChannelSupported(channel: string): boolean {
    return this.channels.has(channel);
  }

  public clear(): void {
    this.templates.clear();
    this.bindings.clear();
    this.definitions.clear();
    this.channels.clear();
  }
}
