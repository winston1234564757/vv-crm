-- Складський ремонт не має платника: NULL означає «не застосовується».
-- 'unpaid' на ньому створював 5 200 ₴ боргу, якого не існує.
update repairs set payment_status = null where inventory_device_id is not null;
