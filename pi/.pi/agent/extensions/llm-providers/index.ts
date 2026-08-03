import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupCrofProvider } from "./crof";

export default async function (pi: ExtensionAPI) {
  // setupDeepInfraProvider(pi);
  // setupCommandCodeProvider(pi);
  await setupCrofProvider(pi);
}
