import { describe, expect, it } from 'vitest'
import { calculatePrice, validateExchangeRate } from './pricing'
describe('pricing engine', () => {
  it('applies costs, margin, then rounds up to configured step', () => {
    expect(calculatePrice({ foreignCost: 100, exchangeRate: 50000, additionalCostToman: 100000, marginPercent: 20, roundingStepToman: 10000 })).toBe(6120000)
  })
  it('rejects invalid exchange rates', () => {
    expect(() => validateExchangeRate(0, 'manual', new Date().toISOString())).toThrow()
  })
  it('rejects stale rates', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    expect(() => validateExchangeRate(50000, 'manual', old)).toThrow('قدیمی')
  })
  it('rejects a margin outside allowed range', () => {
    expect(() => calculatePrice({ foreignCost: 1, exchangeRate: 1, additionalCostToman: 0, marginPercent: 900, roundingStepToman: 1 })).toThrow()
  })
})