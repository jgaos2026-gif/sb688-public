export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();

export function fixedClock(iso: string): Clock {
  return () => iso;
}
