export interface IPlatformService {
  initialize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}
