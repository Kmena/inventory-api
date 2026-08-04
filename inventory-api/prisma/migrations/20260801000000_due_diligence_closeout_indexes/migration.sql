-- Due-diligence closeout: confirmed query-backed indexes only.
-- Keep this slice additive and narrow: User company listing, OrderItem order/product joins,
-- and Invoice client/order joins used by current repository query paths.

CREATE INDEX "users_company_id_id_idx" ON "users"("company_id", "id");

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");
