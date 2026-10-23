export interface PricingRule {
  foreignCost: number
  exchangeRate: number
  additionalCostToman: number
  marginPercent: number
  roundingStepToman: number
}
export function calculatePrice(rule: PricingRule): number {
  const values = [rule.foreignCost, rule.exchangeRate, rule.additionalCostToman, rule.marginPercent, rule.roundingStepToman]
  if (!values.every(Number.isFinite) || rule.foreignCost < 0 || rule.exchangeRate <= 0 || rule.additionalCostToman < 0 || rule.marginPercent < 0 || rule.marginPercent > 500 || !Number.isInteger(rule.roundingStepToman) || rule.roundingStepToman < 1) {
    throw new Error('ورودی‌های قیمت‌گذاری معتبر نیستند.')
  }
  const cost = rule.foreignCost * rule.exchangeRate + rule.additionalCostToman
  const gross = cost * (1 + rule.marginPercent / 100)
  return Math.ceil(gross / rule.roundingStepToman) * rule.roundingStepToman
}
export function validateExchangeRate(rate: number, source: string, observedAt: string, now = Date.now()): void {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('نرخ ارز باید عددی مثبت باشد.')
  if (!source.trim()) throw new Error('منبع نرخ ارز الزامی است.')
  const timestamp = Date.parse(observedAt)
  if (!Number.isFinite(timestamp) || timestamp > now + 60_000) throw new Error('زمان ثبت نرخ ارز معتبر نیست.')
  if (now - timestamp > 24 * 60 * 60 * 1000) throw new Error('نرخ ارز قدیمی است و باید دوباره تأیید شود.')
}