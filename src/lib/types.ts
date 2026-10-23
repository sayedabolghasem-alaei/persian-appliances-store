export type ProductCategory = 'refrigerator' | 'laundry' | 'television' | 'kitchen' | 'cleaning' | 'climate'
export interface Product {
  id: string; slug: string; name: string; brand: string; category: ProductCategory; categoryLabel: string
  priceToman: number; oldPriceToman?: number; rating: number; reviewCount: number; stock: number
  image: string; badge?: string; description: string; model: string; sku: string
}
export interface CartItem { product: Product; quantity: number }
export const toman = (value: number) => `${new Intl.NumberFormat('fa-IR').format(value)} تومان`
export const faNumber = (value: number) => new Intl.NumberFormat('fa-IR').format(value)
