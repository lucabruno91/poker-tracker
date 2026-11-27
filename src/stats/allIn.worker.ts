import { spotEquity, type AllInSpot } from "./allInEv";

export interface EquityMessage {
  handId: string;
  equity: number;
}

/** Contesto minimo del worker (evita di mescolare i tipi "webworker" con quelli DOM). */
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<AllInSpot[]>) => void) | null;
  postMessage(message: EquityMessage): void;
};

/** Calcola le equity degli spot fuori dal thread dell'interfaccia. */
ctx.onmessage = (event) => {
  for (const spot of event.data) {
    ctx.postMessage({ handId: spot.handId, equity: spotEquity(spot) });
  }
};
