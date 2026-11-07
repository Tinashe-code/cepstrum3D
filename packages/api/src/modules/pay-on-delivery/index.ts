import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import PayOnDeliveryProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [PayOnDeliveryProviderService],
});
