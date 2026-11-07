import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils";
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateShippingOptionDTO,
  FulfillmentOption,
} from "@medusajs/framework/types";
import { DELIVERY_CONTEXT_KEY, DeliveryContext } from "../../lib/delivery/context";
import { DeliveryQuoteError, quoteDelivery } from "../../lib/delivery/quote";
import { getDeliverySettings } from "../../lib/delivery/settings";

/**
 * "Delivery" priced by road distance from the vendor to the customer.
 * One shipping option per vendor, so a cart with several vendors pays the sum
 * of each vendor's distance. Free-delivery rules are applied first (see
 * lib/delivery/quote.ts). Provider id on shipping options:
 * "distance-delivery_distance-delivery".
 */
class DistanceDeliveryProviderService extends AbstractFulfillmentProviderService {
  static identifier = "distance-delivery";

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "distance-delivery" }];
  }

  async validateOption(): Promise<boolean> {
    return true;
  }

  async validateFulfillmentData(_optionData: Record<string, unknown>, data: Record<string, unknown>) {
    return data;
  }

  async canCalculate(_data: CreateShippingOptionDTO): Promise<boolean> {
    return true;
  }

  async calculatePrice(
    _optionData: CalculateShippingOptionPriceDTO["optionData"],
    _data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const ctx = context as typeof context & { [DELIVERY_CONTEXT_KEY]?: DeliveryContext };
    const from = (ctx.from_location as { id?: string; address?: Record<string, unknown> } | undefined) ?? {};
    const delivery = ctx[DELIVERY_CONTEXT_KEY];
    const leg = from.id ? delivery?.legs?.[from.id] : undefined;

    try {
      const quote = await quoteDelivery({
        from: (from.address ?? {}) as never,
        to: ctx.shipping_address as never,
        items: leg?.items ?? [],
        goodsTotal: delivery?.goods_total ?? 0,
        settings: getDeliverySettings(),
      });
      return { calculated_amount: quote.amount, is_calculated_price_tax_inclusive: true };
    } catch (e) {
      if (e instanceof DeliveryQuoteError) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message);
      }
      throw e;
    }
  }

  async createFulfillment() {
    return { data: {}, labels: [] };
  }

  async cancelFulfillment() {
    return {};
  }

  async createReturnFulfillment() {
    return { data: {}, labels: [] };
  }
}

export default DistanceDeliveryProviderService;
