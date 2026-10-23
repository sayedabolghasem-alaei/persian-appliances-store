-- Clearly labelled demo records. Prices are Toman and must not be used for real checkout.
insert into public.categories(name,slug,description) values
('یخچال و فریزر','refrigerator','داده نمایشی'),('شست‌وشو','laundry','داده نمایشی'),
('صوتی و تصویری','television','داده نمایشی'),('لوازم آشپزخانه','kitchen','داده نمایشی'),
('نظافت خانه','cleaning','داده نمایشی'),('سرمایش و گرمایش','climate','داده نمایشی')
on conflict(slug) do nothing;
insert into public.brands(name,slug) values
('سامسونگ','samsung'),('ال‌جی','lg'),('سونی','sony'),('بوش','bosch'),('دایسون','dyson'),('دلونگی','delonghi'),('پاناسونیک','panasonic'),('گری','gree')
on conflict(slug) do nothing;
-- Products are intentionally not seeded here with fictional availability/prices.
-- Use the UI demo catalog for local visual review until the business owner approves catalog data.
