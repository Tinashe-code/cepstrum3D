import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import DistanceDeliveryProviderService from "./service";

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [DistanceDeliveryProviderService],
});
