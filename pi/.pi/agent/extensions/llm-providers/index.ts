import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupCommandCodeProvider } from "./commandcode";

export default async function (pi: ExtensionAPI) {
  // setupDeepInfraProvider(pi);
  setupCommandCodeProvider(pi);
}
