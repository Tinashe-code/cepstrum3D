/**
 * Pay on delivery payment provider.
 *
 * Checkout creates the order with the payment *authorized* but not captured — no
 * money moves online. The vendor (or operator) captures the payment from the order
 * page once the courier or vendor has collected cash / EcoCash on delivery.
 *
 * Eligibility (every product in the cart must allow POD) is enforced by the store
 * middlewares in src/api/middlewares.ts, not here, because providers don't see the cart.
 */
import crypto from "crypto";
import {
  AbstractPaymentProvider,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";

class PayOnDeliveryProviderService extends AbstractPaymentProvider {
  static identifier = "pay-on-delivery";

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    return {
      id: `pod_${crypto.randomUUID()}`,
      data: { method: "pay_on_delivery", amount: input.amount, currency_code: input.currency_code },
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    // Authorized = "customer committed to pay on delivery". Captured later.
    return { status: PaymentSessionStatus.AUTHORIZED, data: { ...(input.data ?? {}), collected: false } };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: { ...(input.data ?? {}), collected: true, collected_at: new Date().toISOString() } };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return { status: input.data?.collected ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.AUTHORIZED };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: { ...(input.data ?? {}), amount: input.amount, currency_code: input.currency_code } };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: { ...(input.data ?? {}), cancelled: true } };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { data: { ...(input.data ?? {}), refunded_amount: input.amount } };
  }

  async getWebhookActionAndData(_: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED };
  }
}

export default PayOnDeliveryProviderService;
