/// <reference types="vite/client" />

interface Window {
  ym?: (counterId: number, method: string, ...args: unknown[]) => void;
}
