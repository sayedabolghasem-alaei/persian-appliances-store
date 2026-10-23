# وضعیت یکپارچه‌سازی‌ها

## Supabase
- مرورگر: URL پروژه و anon/publishable key فقط در متغیرهای `VITE_*`.
- migrationها را به ترتیب اعمال کنید.
- ایجاد سفارش فقط با RPC `create_order_secure` و کاربر authenticated انجام می‌شود؛ قیمت از دیتابیس می‌آید نه از کلاینت.
- نقش مدیر را با SQL مورداعتماد ایجاد کنید؛ کلاینت اجازه نوشتن در `user_roles` ندارد.

## پرداخت
`supabase/functions/payment-init` عمداً fail-closed است. انتخاب درگاه و خواندن مستندات رسمی لازم است؛ تا آن زمان هیچ پرداخت واقعی انجام نمی‌شود. در مرحله نهایی باید ایجاد تراکنش، callback، تأیید سرور، idempotency و ثبت audit اضافه شود.

## ترب
`supabase/functions/torob-feed` فید عمومی JSON از محصولات منتشرشده ایجاد می‌کند و با bearer token محافظت می‌شود. این فرمت generic است، نه تأییدشده از طرف ترب. قبل از ارائه، مشخصات جاری ترب را از حساب پذیرنده بررسی و serializer را مطابق همان سند تنظیم کنید.

## نرخ ارز
منبع، timestamp، تازگی نرخ و تأیید مدیر ضروری است. هیچ نرخ زنده‌ای در این پروژه فرض نشده است.

## استقرار Edge Functions
Secrets مانند `SUPABASE_SERVICE_ROLE_KEY`, `TOROB_FEED_TOKEN`, `PUBLIC_SITE_URL`, `PAYMENT_SECRET`, `PAYMENT_MERCHANT_ID`, `PAYMENT_PROVIDER`, `ALLOWED_ORIGIN` فقط با Supabase secrets یا secret manager محیط اجرا تنظیم شوند؛ هرگز commit نکنید.
