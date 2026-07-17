ALTER TABLE "payments"
  ADD CONSTRAINT "payments_reversal_metadata_consistency_chk"
  CHECK (
    (
      status = 'ACTIVE'
      AND reversed_at IS NULL
      AND reversal_reason IS NULL
      AND reversed_by_user_id IS NULL
    )
    OR (
      status = 'REVERSED'
      AND reversed_at IS NOT NULL
      AND reversal_reason IS NOT NULL
    )
  );

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_approval_metadata_consistency_chk"
  CHECK (
    (
      approved = false
      AND approved_at IS NULL
      AND approved_by_id IS NULL
    )
    OR (
      approved = true
      AND approved_at IS NOT NULL
      AND approved_by_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT "orders_status_requires_approval_flag_chk"
  CHECK (
    status <> 'APPROVED'
    OR approved = true
  ),
  ADD CONSTRAINT "orders_approved_allowed_status_chk"
  CHECK (
    approved = false
    OR status IN ('APPROVED', 'DELIVERED')
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_non_negative_chk"
  CHECK (amount >= 0);

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_amount_non_negative_chk"
  CHECK (amount >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_non_negative_chk"
  CHECK (
    down_payment >= 0
    AND total >= 0
    AND other_costs >= 0
  );

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_non_negative_values_chk"
  CHECK (
    quantity >= 0
    AND unit_price >= 0
    AND discount_percent >= 0
    AND discount_amount >= 0
    AND total_discount >= 0
  );

ALTER TABLE "lots"
  ADD CONSTRAINT "lots_non_negative_quantities_chk"
  CHECK (
    quantity >= 0
    AND original_quantity >= 0
  );

ALTER TABLE "warehouse_stocks"
  ADD CONSTRAINT "warehouse_stocks_quantity_bounds_chk"
  CHECK (
    quantity >= 0
    AND reserved_quantity >= 0
    AND reserved_quantity <= quantity
  );

ALTER TABLE "warehouse_lot_stocks"
  ADD CONSTRAINT "warehouse_lot_stocks_quantity_bounds_chk"
  CHECK (
    quantity >= 0
    AND reserved_quantity >= 0
    AND reserved_quantity <= quantity
  );

ALTER TABLE "products"
  ADD CONSTRAINT "products_quantity_bounds_chk"
  CHECK (
    quantity >= 0
    AND reserved_quantity >= 0
    AND reserved_quantity <= quantity
  );
