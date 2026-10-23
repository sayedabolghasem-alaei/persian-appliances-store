import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { faNumber, toman, type Product } from '../lib/types'

type Cart = Record<string, number>

function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeCell = (value: string | number | null | undefined) => {
    let text = String(value ?? '')
    // Prevent spreadsheet formula execution when a CSV is opened in Excel/LibreOffice.
    if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const csv = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  URL.revokeObjectURL(url)
}

export function AccountPage({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null)
      if (session?.user) void supabase!.from('orders').select('id,order_number,status,payment_status,total_toman,created_at').order('created_at',{ascending:false}).then(({data})=>setOrders(data ?? []))
      else setOrders([])
    })
    return () => listener.subscription.unsubscribe()
  }, [])
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return
    setBusy(true); setMessage('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + '/account' } })
        if (error) throw error
        setMessage('ثبت‌نام ارسال شد. اگر تأیید ایمیل فعال باشد، صندوق ایمیل را بررسی کنید.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('ورود موفق بود.')
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : 'عملیات ناموفق بود.') }
    finally { setBusy(false) }
  }
  async function signOut() { if (supabase) await supabase.auth.signOut() }
  return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><span>حساب کاربری</span></div><div className="connected-panel"><span className="eyebrow">حساب خانه‌گی</span><h1>حساب کاربری و سفارش‌ها</h1>{!configured ? <><p>برای فعال‌شدن ورود، ثبت‌نام و سفارش‌ها، ابتدا مقادیر Supabase را در فایل <code>.env</code> وارد کنید و حالت نمایشی را خاموش کنید.</p><p dir="ltr">VITE_USE_DEMO_DATA=false</p><Link to="/products" className="button button-primary">مشاهده محصولات</Link></> : sessionEmail ? <><p>وارد شده‌اید با <b dir="ltr">{sessionEmail}</b></p><button className="button button-outline" onClick={signOut}>خروج از حساب</button><h2>سفارش‌های اخیر</h2>{orders.length ? <div className="connected-table">{orders.map(o=><div key={o.id}><span>سفارش {faNumber(o.order_number)}</span><span>{o.status}</span><b>{toman(Number(o.total_toman))}</b></div>)}</div> : <p>هنوز سفارشی ثبت نشده است.</p>}</> : <><div className="toggle-row"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>ورود</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>ثبت‌نام</button></div><form className="connected-form" onSubmit={submit}>{mode==='signup'&&<label>نام و نام خانوادگی<input required value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name"/></label>}<label>ایمیل<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>رمز عبور<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'}/></label><button disabled={busy} className="button button-primary" type="submit">{busy?'در حال انجام…':mode==='login'?'ورود به حساب':'ساخت حساب'}</button></form>{message&&<p role="status">{message}</p>}</>}</div></main>
}

export function CheckoutPage({ catalog, cart, clearCart }: { catalog: Product[]; cart: Cart; clearCart: () => void }) {
  const [name,setName] = useState(''); const [phone,setPhone] = useState(''); const [province,setProvince] = useState(''); const [city,setCity] = useState(''); const [address,setAddress] = useState(''); const [postal,setPostal] = useState(''); const [note,setNote] = useState('')
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState(''); const [userId,setUserId] = useState<string | null>(null)
  const items = catalog.filter(p=>cart[p.id]).map(p=>({product:p,quantity:cart[p.id]})); const subtotal=items.reduce((sum,i)=>sum+i.product.priceToman*i.quantity,0)
  useEffect(()=>{ void supabase?.auth.getUser().then(({data})=>setUserId(data.user?.id ?? null)) },[])
  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage('')
    if (!supabase) { setMessage('برای ثبت سفارش واقعی، Supabase را پیکربندی کنید.'); return }
    if (!userId) { setMessage('برای ثبت سفارش ابتدا وارد حساب کاربری شوید.'); return }
    if (!items.length) { setMessage('سبد خرید خالی است.'); return }
    if (items.some(i => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(i.product.id))) { setMessage('سبد شامل کالای نمایشی است؛ برای ثبت سفارش واقعی، حالت دمو را خاموش و محصولات دیتابیس را بارگذاری کنید.'); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('create_order_secure', { p_customer_name:name, p_customer_phone:phone, p_customer_email:null, p_address:{province,city,address_line:address,postal_code:postal}, p_customer_note:note, p_items:items.map(i=>({product_id:i.product.id,quantity:i.quantity})) })
      if (error) throw error
      clearCart(); setMessage(`سفارش شماره ${data.order_number} ثبت شد. پرداخت آنلاین هنوز نیازمند اتصال درگاه و تأیید سرور است.`)
    } catch (err) { setMessage(err instanceof Error ? err.message : 'ثبت سفارش ناموفق بود.') }
    finally { setBusy(false) }
  }
  return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><Link to="/cart">سبد خرید</Link><span>/</span><span>ثبت سفارش</span></div><h1 className="page-heading">ثبت سفارش</h1>{!items.length ? <div className="empty-state"><h2>سبد خرید خالی است</h2><Link className="button button-primary" to="/products">مشاهده محصولات</Link></div> : <div className="checkout-layout"><form className="connected-panel connected-form" onSubmit={submit}><h2>اطلاعات گیرنده و نشانی</h2>{!userId&&<p>برای ثبت سفارش باید وارد حساب شوید. <Link to="/account">ورود / ثبت‌نام</Link></p>}<label>نام گیرنده<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><label>شماره موبایل<input required pattern="[0-9۰-۹+ -]{10,16}" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label><div className="form-pair"><label>استان<input required value={province} onChange={e=>setProvince(e.target.value)}/></label><label>شهر<input required value={city} onChange={e=>setCity(e.target.value)}/></label></div><label>نشانی کامل<input required value={address} onChange={e=>setAddress(e.target.value)} autoComplete="street-address"/></label><label>کد پستی<input required minLength={10} maxLength={10} value={postal} onChange={e=>setPostal(e.target.value)}/></label><label>توضیحات سفارش<textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}/></label><button disabled={busy||!userId} className="button button-primary" type="submit">{busy?'در حال ثبت…':'ثبت سفارش (بدون پرداخت آنلاین)'}</button>{message&&<p role="status">{message}</p>}</form><aside className="summary-card"><h2>خلاصه سفارش</h2>{items.map(i=><div key={i.product.id}><span>{i.product.name} × {faNumber(i.quantity)}</span><b>{toman(i.product.priceToman*i.quantity)}</b></div>)}<hr/><div className="summary-total"><span>جمع کالاها</span><strong>{toman(subtotal)}</strong></div><small className="summary-hint">قیمت و موجودی نهایی سمت سرور کنترل می‌شود. هزینه ارسال در این نسخه صفر است تا تنظیم روش ارسال انجام شود.</small></aside></div>}</main>
}

export function AdminPage({ configured }: { configured: boolean }) {
  const [allowed,setAllowed] = useState(false); const [isAdmin,setIsAdmin] = useState(false); const [products,setProducts] = useState<any[]>([]); const [orders,setOrders] = useState<any[]>([]); const [message,setMessage] = useState('')
  const [name,setName] = useState(''); const [slug,setSlug] = useState(''); const [sku,setSku] = useState(''); const [price,setPrice] = useState(''); const [stock,setStock] = useState('0')
  async function refresh() {
    if (!supabase) return
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id',(await supabase.auth.getUser()).data.user?.id ?? '').in('role',['admin','staff','super_admin'])
    const hasAccess=Boolean(role?.length); setAllowed(hasAccess); setIsAdmin(Boolean(role?.some((r: {role:string}) => r.role === 'admin' || r.role === 'super_admin')))
    if (!hasAccess) return
    const [p,o]=await Promise.all([supabase.from('products').select('id,name,sku,slug,price_toman,is_published').order('created_at',{ascending:false}).limit(100),supabase.from('orders').select('id,order_number,status,payment_status,total_toman,created_at').order('created_at',{ascending:false}).limit(100)])
    setProducts(p.data??[]); setOrders(o.data??[])
  }
  useEffect(()=>{ void refresh() },[])
  async function addProduct(e: FormEvent) { e.preventDefault(); if(!supabase)return; setMessage('')
    const priceValue = Number(price), stockValue = Number(stock)
    if (!Number.isSafeInteger(priceValue) || priceValue < 0 || !Number.isSafeInteger(stockValue) || stockValue < 0) { setMessage('قیمت و موجودی باید عدد صحیح و غیرمنفی باشند.'); return }
    const { error } = await supabase.rpc('create_product_draft_secure', { p_name:name.trim(), p_slug:slug.trim(), p_sku:sku.trim(), p_price_toman:priceValue, p_initial_stock:stockValue })
    if(error){setMessage(error.message);return}
    setMessage('محصول و موجودی اولیه به‌صورت اتمیک و در وضعیت پیش‌نویس ذخیره شدند.');setName('');setSlug('');setSku('');setPrice('');setStock('0');void refresh()
  }
  async function updateStatus(id:string,status:string) { if(!supabase)return; const {error}=await supabase.from('orders').update({status}).eq('id',id); setMessage(error?.message??'وضعیت سفارش به‌روزرسانی شد.');void refresh() }
  async function togglePublished(p:any) { if(!supabase || !isAdmin)return; const {error}=await supabase.from('products').update({is_published:!p.is_published}).eq('id',p.id); setMessage(error?.message ?? 'وضعیت انتشار تغییر کرد.'); void refresh() }
  if(!configured)return <main className="wrap page-main"><div className="connected-panel"><h1>پنل مدیریت</h1><p>ابتدا Supabase را پیکربندی کنید.</p></div></main>
  return <main className="wrap page-main"><div className="breadcrumbs"><Link to="/">خانه</Link><span>/</span><span>مدیریت</span></div><div className="connected-panel"><span className="eyebrow">دسترسی محدود به نقش مدیر یا کارمند</span><h1>پنل مدیریت</h1>{!allowed?<><p>برای مشاهده اطلاعات باید وارد حسابی با نقش admin یا staff شوید. نقش‌ها را فقط از داشبورد امن Supabase یا مهاجرت مدیریت ایجاد کنید.</p><Link className="button button-primary" to="/account">ورود به حساب</Link><button className="button button-outline" onClick={()=>void refresh()}>بررسی دسترسی دوباره</button></>:<><div className="admin-stats"><div><b>{faNumber(products.length)}</b><span>محصولات</span></div><div><b>{faNumber(orders.length)}</b><span>سفارش‌ها</span></div></div><div className="admin-export-actions"><button className="button button-outline" onClick={()=>exportCsv(`khanegi-products-${new Date().toISOString().slice(0,10)}.csv`,['id','name','sku','slug','price_toman','is_published'],products.map(p=>[p.id,p.name,p.sku,p.slug,p.price_toman,p.is_published]))}>خروجی CSV محصولات</button><button className="button button-outline" onClick={()=>exportCsv(`khanegi-orders-${new Date().toISOString().slice(0,10)}.csv`,['id','order_number','status','payment_status','total_toman','created_at'],orders.map(o=>[o.id,o.order_number,o.status,o.payment_status,o.total_toman,o.created_at]))}>خروجی CSV سفارش‌ها</button></div>{isAdmin&&<><h2>افزودن پیش‌نویس محصول</h2><form className="connected-form" onSubmit={addProduct}><label>نام محصول<input required value={name} onChange={e=>setName(e.target.value)}/></label><div className="form-pair"><label>Slug انگلیسی<input required pattern="[a-z0-9-]+" value={slug} onChange={e=>setSlug(e.target.value)}/></label><label>SKU<input required value={sku} onChange={e=>setSku(e.target.value)}/></label></div><label>قیمت (تومان)<input required type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>موجودی اولیه<input required type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)}/></label><button className="button button-primary" type="submit">ذخیره پیش‌نویس</button></form></>}<h2>سفارش‌های اخیر</h2><div className="connected-table">{orders.map(o=><div key={o.id}><span>#{faNumber(o.order_number)} · {o.payment_status}</span><b>{toman(Number(o.total_toman))}</b><select aria-label="وضعیت سفارش" value={o.status} onChange={e=>void updateStatus(o.id,e.target.value)}><option value="pending">در انتظار</option><option value="confirmed">تأیید شده</option><option value="processing">در حال پردازش</option><option value="shipped">ارسال شده</option><option value="delivered">تحویل شده</option><option value="cancelled">لغو شده</option></select></div>)}</div><h2>محصولات</h2><div className="connected-table">{products.map(p=><div key={p.id}><span>{p.name} · {p.sku}</span><b>{toman(Number(p.price_toman))}</b><span>{p.is_published?'منتشر':'پیش‌نویس'}</span>{isAdmin&&<button className="button button-outline" onClick={()=>void togglePublished(p)}>{p.is_published?'پیش‌نویس کردن':'انتشار'}</button>}</div>)}</div></>}{message&&<p role="status">{message}</p>}</div></main>
}
