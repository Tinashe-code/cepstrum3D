import { AbstractNotificationProviderService } from "@medusajs/framework/utils";
import type { ProviderSendNotificationDTO, ProviderSendNotificationResultsDTO } from "@medusajs/framework/types";

/**
 * In-store messages (channel "inbox"). Nothing is sent anywhere: the
 * notification module stores every notification, and the storefront's
 * Notifications page reads the ones for the signed-in customer
 * (GET /store/customers/me/notifications).
 */
class InboxNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "inbox-notification";

  async send(_notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    return {};
  }
}

export default InboxNotificationProviderService;
