import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Check, ChevronDown, Heart, Menu, PackageCheck, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Truck, X, Zap } from 'lucide-react'
import { demoProducts } from './lib/products'
import { faNumber, toman, type Product } from './lib/types'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { AccountPage, AdminPage, CheckoutPage } from './pages/ConnectedPages'

function App() {
  const [cart, setCart] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem('khanegi-cart') || '{}') } catch { return {} } })
  const [wishlist, setWishlist] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('khanegi-wishlist') || '[]') } catch { return [] } })
  const demoMode = !isSupabaseConfigured || import.meta.env.VITE_USE_DEMO_DATA === 'true'
  const [catalog, setCatalog] = useState<Product[]>(demoMode ? demoProducts : [])
  const [catalogSource, setCatalogSource] = useState<'demo' | 'supabase' | 'error' | 'loading'>(demoMode ? 'demo' : 'loading')
  useEffect(() => { localStorage.setItem('khanegi-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem('khanegi-wishlist', JSON.stringify(wishlist)) }, [wishlist])
  useEffect(() => {
    if (!supabase || demoMode) return
    let active = true
    void supabase.from('public_product_catalog').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return
      if (error || !data) { setCatalog([]); setCatalogSource('error'); return }
      const mapped: Product[] = data.map((row: any) => ({ id: row.id, slug: row.slug, name: row.name, sku: row.sku, model: row.model || '', description: row.description || '', brand: row.brand_name || 'بدون برند', category: (row.category_slug || 'kitchen') as Product['category'], categoryLabel: row.category_name || 'لوازم خانه', priceToman: Number(row.price_toman), oldPriceToman: row.compare_at_price_toman ? Number(row.compare_at_price_toman) : undefined, rating: 5, reviewCount: 0, stock: row.available ? 1 : 0, image: row.image_url || 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80' }))
      setCatalog(mapped); setCatalogSource('supabase')
    })
    return () => { active = false }
  }, [demoMode])
  const [query, setQuery] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)
  const add = (id: string) => setCart(prev => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, catalog.find(p => p.id === id)?.stock ?? 1) }))
  const toggleWish = (id: string) => setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return <div className="app-shell">
    <div className="announcement"><span><Zap size={14}/> پیشنهادهای ویژه خانه‌گی؛ انتخاب هوشمند برای خانه شما</span><span className="announcement-side">پشتیبانی هر روز، از ۹ تا ۲۱</span></div>
    <header className="site-header">
      <div className="header-main wrap">
        <button className="icon-button mobile-only" aria-label="باز کردن منو" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X/> : <Menu/>}</button>
        <Link to="/" className="brand-mark"><span className="brand-symbol"><ShoppingBag size={23}/></span><span><strong>خانه‌گی</strong><small>انتخاب خوب، خانه بهتر</small></span></Link>
        <form className="search-box" onSubmit={e => { e.preventDefault(); window.location.href = `/search?q=${encodeURIComponent(query)}` }}>
          <Search size={19}/><input aria-label="جست‌وجوی محصول" value={query} onChange={e => setQuery(e.target.value)} placeholder="نام محصول، برند یا مدل را جست‌وجو کنید..." /><button type="submit">جست‌وجو</button>
        </form>
        <div className="header-actions"><Link to="/account" className="header-link"><span className="action-icon">♙</span><span>حساب کاربری</span></Link><Link to="/cart" className="cart-link"><span className="cart-icon"><ShoppingBag size={21}/><b>{faNumber(cartCount)}</b></span><span>سبد خرید</span></Link></div>
      </div>
      <nav className={`category-nav ${mobileMenu ? 'nav-open' : ''}`}><div className="wrap nav-inner">
        <Link to="/products?category=refrigerator">یخچال و فریزر</Link><Link to="/products?category=laundry">شست‌وشو</Link><Link to="/products?category=television">صوتی و تصویری</Link><Link to="/products?category=kitchen">لوازم آشپزخانه</Link><Link to="/products?category=cleaning">نظافت خانه</Link><Link to="/products?category=climate">سرمایش و گرمایش</Link><Link to="/products" className="all-products">همه محصولات <ChevronDown size={15}/></Link>
      </div></nav>
    </header>
    <Routes>
      <Route path="/" element={<Home add={add} wishlist={wishlist} toggleWish={toggleWish} catalog={catalog}/>} />
      <Route path="/products" element={<Catalog add={add} wishlist={wishlist} toggleWish={toggleWish} catalog={catalog}/>} />
      <Route path="/search" element={<Catalog add={add} wishlist={wishlist} toggleWish={toggleWish} searchMode catalog={catalog}/>} />
      <Route path="/product/:slug" element={<ProductPage add={add} wishlist={wishlist} toggleWish={toggleWish} catalog={catalog}/>} />
      <Route path="/cart" element={<Cart cart={cart} setCart={setCart} catalog={catalog}/>} />
      <Route path="/account" element={<AccountPage configured={isSupabaseConfigured} />} />
      <Route path="/checkout" element={<CheckoutPage catalog={catalog} cart={cart} clearCart={() => setCart({})} />} />
      <Route path="/admin" element={<AdminPage configured={isSupabaseConfigured} />} />
      <Route path="*" element={<InfoPage title="صفحه‌ای پیدا نشد" text="آدرس واردشده معتبر نیست یا صفحه جابه‌جا شده است."/>} />
    </Routes>
    <Footer/>
    <div className={`demo-notice ${catalogSource === 'error' ? 'demo-notice-error' : ''}`} role={catalogSource === 'error' ? 'alert' : 'status'}>{catalogSource === 'demo' ? 'حالت نمایشی — محصولات و قیمت‌ها نمونه هستند و برای فروش واقعی استفاده نشوند.' : catalogSource === 'loading' ? 'در حال دریافت کاتالوگ فروشگاه…' : catalogSource === 'error' ? 'کاتالوگ واقعی بارگذاری نشد؛ برای جلوگیری از نمایش قیمت نمونه، محصولات پنهان شده‌اند. اتصال و مجوزهای Supabase را بررسی کنید.' : 'کاتالوگ متصل به Supabase؛ پرداخت فقط پس از پیکربندی درگاه فعال می‌شود.'}</div>
  </div>
  function Home(props: { add: (id: string) => void; wishlist: string[]; toggleWish: (id: string) => void; catalog: Product[] }) {
    const featured = props.catalog.slice(0, 4)
    return <main>
      <section className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><span/> خانه‌ای که دوستش دارید</div><h1>انتخاب‌های هوشمند<br/><em>برای زندگی بهتر</em></h1><p>از لوازم ضروری تا جزئیات دوست‌داشتنی خانه؛ با خیال راحت انتخاب کنید و با اطمینان تحویل بگیرید.</p><div className="hero-buttons"><Link to="/products" className="button button-primary">مشاهده محصولات <ArrowLeft size={17}/></Link><a href="#categories" className="button button-quiet">دسته‌بندی‌ها</a></div><div className="hero-proof"><span><Check size={15}/> ضمانت اصالت کالا</span><span><Check size={15}/> ارسال مطمئن</span></div></div>
        <div className="hero-visual"><div className="hero-image"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=90" alt="چیدمان مدرن و آرام یک خانه" /></div><div className="hero-float"><span className="float-icon"><BadgeCheck size={21}/></span><span><b>انتخاب با اطمینان</b><small>جزئیات شفاف، خرید آسان</small></span></div><div className="hero-stamp"><span>خانه‌ی</span><strong>بهتر</strong></div></div>
      </section>
      <section className="trust-strip wrap"><Trust icon={<ShieldCheck/>} title="ضمانت معتبر" text="اطمینان در انتخاب" /><Trust icon={<Truck/>} title="ارسال برنامه‌ریزی‌شده" text="هماهنگ با شما" /><Trust icon={<PackageCheck/>} title="پشتیبانی تخصصی" text="همراه تا پس از خرید" /><Trust icon={<BadgeCheck/>} title="قیمت شفاف" text="بدون هزینه پنهان" /></section>
      <section id="categories" className="section wrap"><div className="section-heading"><div><span className="eyebrow">برای هر گوشه خانه</span><h2>دسته‌بندی محصولات</h2></div><Link className="text-link" to="/products">همه دسته‌ها <ArrowLeft size={16}/></Link></div><div className="category-grid">
        {[
          ['refrigerator','یخچال و فریزر','https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=700&q=80','01'],
          ['laundry','شست‌وشو','https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=700&q=80','02'],
          ['television','صوتی و تصویری','https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=700&q=80','03'],
          ['kitchen','لوازم آشپزخانه','https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80','04'],
        ].map(([id, name, img, no]) => <Link to={`/products?category=${id}`} className="category-card" key={id}><img src={img} alt="" loading="lazy"/><span className="category-number">{no}</span><span className="category-name">{name}<ArrowLeft size={17}/></span></Link>)}
      </div></section>
      <section className="section products-section"><div className="wrap"><div className="section-heading"><div><span className="eyebrow">پیشنهاد خانه‌گی</span><h2>محبوب‌های این روزها</h2><p>محصولاتی که ارزش یک انتخاب خوب را دارند.</p></div><Link className="text-link" to="/products">مشاهده همه <ArrowLeft size={16}/></Link></div><div className="product-grid">{featured.map(p => <ProductCard key={p.id} product={p} {...props}/>)}</div></div></section>
      <section className="promo-wrap wrap"><div className="promo-copy"><span className="eyebrow">جزئیات کوچک، تفاوت بزرگ</span><h2>خانه‌تان را<br/>برای خودتان بسازید.</h2><p>با انتخاب‌های کاربردی و طراحی ماندگار، تجربه هر روز را بهتر کنید.</p><Link to="/products" className="button button-light">کشف محصولات <ArrowLeft size={16}/></Link></div><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85" alt="فضای روشن و مدرن خانه" loading="lazy"/></section>
      <section className="section wrap"><div className="newsletter"><div><span className="eyebrow">خبرهای خانه‌گی</span><h2>پیشنهادهای خوب را از دست ندهید</h2><p>برای اطلاع از محصولات تازه و پیشنهادهای ویژه همراه ما باشید.</p></div><form onSubmit={e => {e.preventDefault(); alert('این قابلیت در نسخه نمایشی فعال نیست.')}}><input type="email" aria-label="ایمیل شما" placeholder="نشانی ایمیل شما" required/><button className="button button-primary">عضویت <ArrowLeft size={16}/></button></form></div></section>
    </main>
  }
}

function Trust({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) { return <div className="trust-item"><span>{icon}</span><div><b>{title}</b><small>{text}</small></div></div> }
function ProductCard({product,add,wishlist,toggleWish}:{product:Product;add:(id:string)=>void;wishlist:string[];toggleWish:(id:string)=>void}) {
  const discount = product.oldPriceToman ? Math.round((1-product.priceToman/product.oldPriceToman)*100) : 0
  return <article className="product-card"><div className="product-image"><Link to={`/product/${product.slug}`}><img src={product.image} alt={product.name} loading="lazy"/></Link>{product.badge && <span className="product-badge">{product.badge}</span>}<button className={`wish-button ${wishlist.includes(product.id)?'wished':''}`} aria-label="افزودن به علاقه‌مندی‌ها" onClick={()=>toggleWish(product.id)}><Heart size={18} fill={wishlist.includes(product.id)?'currentColor':'none'}/></button>{discount>0 && <span className="discount-badge">{faNumber(discount)}٪</span>}</div><div className="product-info"><span className="product-brand">{product.brand}</span><Link to={`/product/${product.slug}`} className="product-title">{product.name}</Link><div className="product-rating"><span>★</span> {faNumber(product.rating)} <small>({faNumber(product.reviewCount)} دیدگاه)</small></div><div className="product-price">{product.oldPriceToman && <del>{toman(product.oldPriceToman)}</del>}<strong>{toman(product.priceToman)}</strong></div><button className="add-cart" onClick={()=>add(product.id)}><ShoppingBag size={17}/> افزودن به سبد خرید</button></div></article>
}
function Catalog({add,wishlist,toggleWish,searchMode=false,catalog}:{add:(id:string)=>void;wishlist:string[];toggleWish:(id:string)=>void;searchMode?:boolean;catalog:Product[]}) {
  const [params,setParams] = useSearchParams()
  const [sort,setSort] = useState('featured')
  const [filterOpen,setFilterOpen] = useState(false)
  const query = searchMode ? (params.get('q') ?? '') : ''
  const category = params.get('category') ?? ''
  const [brand,setBrand] = useState('')
  const [saleOnly,setSaleOnly] = useState(false)
  const products = useMemo(()=>catalog.filter(p=>(!query || `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))&&(!category||p.category===category)&&(!brand||p.brand===brand)&&(!saleOnly||!!p.oldPriceToman)).sort((a,b)=>sort==='price-asc'?a.priceToman-b.priceToman:sort==='price-desc'?b.priceToman-a.priceToman:sort==='rating'?b.rating-a.rating:0),[catalog,query,category,brand,saleOnly,sort])
  const clear=()=>{setBrand('');setSaleOnly(false);setParams(searchMode&&query?{q:query}:{})}
  return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><span>{searchMode?'نتایج جست‌وجو':'محصولات'}</span></div><div className="listing-title"><div><span className="eyebrow">انتخابی برای خانه شما</span><h1>{searchMode?`نتایج جست‌وجو برای «${query}»`:'همه محصولات'}</h1><p>{faNumber(products.length)} محصول در این فهرست</p></div><button className="filter-mobile button button-outline" onClick={()=>setFilterOpen(!filterOpen)}><SlidersHorizontal size={17}/> فیلترها</button></div>
    <div className="listing-layout"><aside className={`filters ${filterOpen?'filters-open':''}`}><div className="filter-head"><b>فیلتر محصولات</b><button onClick={clear}>حذف فیلترها</button></div><label className="filter-label">برند</label><select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">همه برندها</option>{[...new Set(catalog.map(p=>p.brand))].map(b=><option key={b}>{b}</option>)}</select><label className="check-row"><input type="checkbox" checked={saleOnly} onChange={e=>setSaleOnly(e.target.checked)}/> فقط کالاهای تخفیف‌دار</label><button className="button button-primary filter-apply" onClick={()=>setFilterOpen(false)}>اعمال فیلتر</button></aside>
      <div className="listing-results"><div className="sort-bar"><span>نمایش {faNumber(products.length)} کالا</span><label>مرتب‌سازی: <select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">پیشنهاد خانه‌گی</option><option value="price-asc">ارزان‌ترین</option><option value="price-desc">گران‌ترین</option><option value="rating">محبوب‌ترین</option></select></label></div>{products.length?<div className="product-grid">{products.map(p=><ProductCard key={p.id} product={p} add={add} wishlist={wishlist} toggleWish={toggleWish}/>)}</div>:<div className="empty-state"><Search size={32}/><h3>محصولی پیدا نشد</h3><p>عبارت جست‌وجو یا فیلترها را تغییر دهید.</p><button className="button button-outline" onClick={clear}>پاک کردن فیلترها</button></div>}</div></div></main>
}
function ProductPage({add,wishlist,toggleWish,catalog}:{add:(id:string)=>void;wishlist:string[];toggleWish:(id:string)=>void;catalog:Product[]}) {
  const {slug}=useParams(); const product=catalog.find(p=>p.slug===slug)
  if(!product) return <InfoPage title="محصول پیدا نشد" text="ممکن است این محصول از فهرست خارج شده باشد."/>
  return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><Link to="/products">محصولات</Link><span>/</span><span>{product.name}</span></div><div className="detail-layout"><div className="detail-image"><img src={product.image} alt={product.name}/>{product.badge&&<span className="product-badge">{product.badge}</span>}</div><div className="detail-copy"><span className="eyebrow">{product.categoryLabel}</span><h1>{product.name}</h1><div className="product-rating"><span>★</span> {faNumber(product.rating)} <small>({faNumber(product.reviewCount)} دیدگاه نمونه)</small></div><p className="detail-description">{product.description}</p><div className="detail-specs"><div><span>برند</span><b>{product.brand}</b></div><div><span>مدل</span><b dir="ltr">{product.model}</b></div><div><span>شناسه کالا</span><b dir="ltr">{product.sku}</b></div><div><span>وضعیت موجودی</span><b className="stock-text">{product.stock>0?'موجود در انبار':'ناموجود'}</b></div></div><div className="detail-price">{product.oldPriceToman&&<del>{toman(product.oldPriceToman)}</del>}<strong>{toman(product.priceToman)}</strong></div><div className="detail-actions"><button className="button button-primary" onClick={()=>add(product.id)}><ShoppingBag size={18}/> افزودن به سبد خرید</button><button className="button button-outline" onClick={()=>toggleWish(product.id)}><Heart size={18} fill={wishlist.includes(product.id)?'currentColor':'none'}/> علاقه‌مندی‌ها</button></div><div className="delivery-note"><Truck size={20}/><span><b>ارسال و تحویل</b><small>زمان و هزینه ارسال پس از تعیین نشانی بررسی می‌شود.</small></span></div></div></div><section className="section"><div className="section-heading"><div><span className="eyebrow">شاید بپسندید</span><h2>محصولات مرتبط</h2></div></div><div className="product-grid">{catalog.filter(p=>p.id!==product.id).slice(0,4).map(p=><ProductCard key={p.id} product={p} add={add} wishlist={wishlist} toggleWish={toggleWish}/>)}</div></section></main>
}
function Cart({cart,setCart,catalog}:{cart:Record<string,number>;setCart:React.Dispatch<React.SetStateAction<Record<string,number>>>;catalog:Product[]}) {
  const items=catalog.filter(p=>cart[p.id]).map(product=>({product,quantity:cart[product.id]})); const subtotal=items.reduce((sum,i)=>sum+i.product.priceToman*i.quantity,0)
  return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><span>سبد خرید</span></div><h1 className="page-heading">سبد خرید شما</h1>{items.length?<div className="cart-layout"><div className="cart-items">{items.map(({product,quantity})=><div className="cart-item" key={product.id}><img src={product.image} alt={product.name}/><div className="cart-item-info"><Link to={`/product/${product.slug}`}>{product.name}</Link><small>{product.brand}</small><b>{toman(product.priceToman)}</b><div className="quantity-control"><button aria-label="کم کردن تعداد" onClick={()=>setCart(prev=>{const next={...prev};if(quantity<=1)delete next[product.id];else next[product.id]--;return next})}>−</button><span>{faNumber(quantity)}</span><button aria-label="افزایش تعداد" onClick={()=>setCart(prev=>({...prev,[product.id]:Math.min(quantity+1,product.stock)}))} disabled={quantity>=product.stock}>+</button></div></div><button className="remove-item" aria-label="حذف محصول" onClick={()=>setCart(prev=>{const n={...prev};delete n[product.id];return n})}><X size={18}/></button></div>)}</div><aside className="summary-card"><h2>خلاصه سفارش</h2><div><span>جمع کالاها</span><b>{toman(subtotal)}</b></div><div><span>هزینه ارسال</span><span>در مرحله بعد</span></div><hr/><div className="summary-total"><span>مبلغ قابل پرداخت</span><strong>{toman(subtotal)}</strong></div><button className="button button-primary checkout-button" onClick={()=>{ window.location.href='/checkout' }}>ادامه و ثبت سفارش <ArrowLeft size={17}/></button><small className="summary-hint">قیمت و موجودی نهایی در سرور بررسی می‌شود.</small></aside></div>:<div className="empty-state"><ShoppingBag size={36}/><h2>سبد خرید شما خالی است</h2><p>با دیدن محصولات، انتخاب مورد علاقه‌تان را شروع کنید.</p><Link to="/products" className="button button-primary">مشاهده محصولات <ArrowLeft size={17}/></Link></div>}</main>
}
function InfoPage({title,text}:{title:string;text:string}) { return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><span>{title}</span></div><div className="info-page"><span className="info-icon"><ShieldCheck size={30}/></span><h1>{title}</h1><p>{text}</p><Link to="/" className="button button-primary">بازگشت به خانه</Link></div></main> }
function Footer() { return <footer className="site-footer"><div className="wrap footer-grid"><div className="footer-brand"><Link to="/" className="brand-mark"><span className="brand-symbol"><ShoppingBag size={22}/></span><span><strong>خانه‌گی</strong><small>انتخاب خوب، خانه بهتر</small></span></Link><p>همراه شما برای انتخاب آگاهانه‌تر لوازم خانه؛ با اطلاعات روشن و تجربه خرید ساده.</p></div><div><b>راهنمای خرید</b><Link to="/products">همه محصولات</Link><Link to="/cart">سبد خرید</Link><Link to="/account">حساب کاربری</Link></div><div><b>خدمات مشتریان</b><a href="#shipping">روش‌های ارسال</a><a href="#returns">بازگشت کالا</a><a href="#faq">پرسش‌های متداول</a></div><div><b>با خانه‌گی</b><a href="#about">درباره ما</a><a href="#contact">تماس با ما</a><span className="footer-contact">اطلاعات تماس پس از تأیید کسب‌وکار درج می‌شود.</span></div></div><div className="wrap footer-bottom"><span>© خانه‌گی — محتوای نمایشی پروژه</span><span>ساخته‌شده برای تجربه خرید بهتر</span></div></footer> }
export default App
