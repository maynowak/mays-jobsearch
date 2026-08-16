import { chat, isFreeDailyQuotaError } from "./providers/index.mjs";
import { setSafetyObserver as setEdenaiSafetyObserver } from "./providers/edenai.mjs";
import { setSafetyObserver as setOpenRouterSafetyObserver } from "./providers/openrouter.mjs";

const MAX_EVENTS = 100;
const safetyEvents = [];

const safetyObserver = {
  emit(event) {
    if (event && event.type) {
      safetyEvents.push({ ...event, observedAt: new Date().toISOString() });
      if (safetyEvents.length > MAX_EVENTS) safetyEvents.shift();
    }
  },
};

setEdenaiSafetyObserver(safetyObserver);
setOpenRouterSafetyObserver(safetyObserver);

export function getSafetyEvents() {
  return [...safetyEvents];
}

export { chat, isFreeDailyQuotaError };
