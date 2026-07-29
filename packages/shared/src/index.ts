export {
  normalizeHostname,
  subdomainSlug,
  validateSubdomainSlug,
  RESERVED_SLUGS,
  type SlugValidation,
} from './hostname';

export { normalizeEmail, normalizePhone, slugify } from './normalize';

export {
  calculateOrderTotals,
  formatMoney,
  savingsPercent,
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  type Currency,
  type OrderLineInput,
  type OrderTotals,
} from './money';

export {
  extractAttribution,
  hasAttribution,
  UTM_KEYS,
  CLICK_ID_KEYS,
  type Attribution,
  type UtmKey,
  type ClickIdKey,
} from './attribution';

export {
  ORDER_STATUSES,
  SITE_STATUSES,
  CONTACT_STATUSES,
  PAYMENT_METHODS,
  isOrderStatus,
  type OrderStatus,
  type SiteStatus,
  type ContactStatus,
  type PaymentMethod,
} from './enums';

export { buildWhatsAppUrl, type WhatsAppMessageContext } from './whatsapp';
