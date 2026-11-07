import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import InboxNotificationProviderService from "./service";

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [InboxNotificationProviderService],
});
