/// <reference types="vite/client" />

interface Window {
  ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  _tmr?: Array<Record<string, string | number>>;
}
