erDiagram
    COMPANY ||--o{ USER : has
    ROLE ||--o{ USER : assigns

    COMPANY ||--o{ CLIENT : has
    COMPANY ||--o{ WAREHOUSE : has
    COMPANY ||--o{ PRODUCT : owns
    COMPANY ||--o{ SUPPLIER : has

    CATEGORY ||--o{ PRODUCT : classifies
    PRODUCT ||--o{ PRODUCT_PRICE : has
    PRODUCT ||--o{ PRODUCT_BARCODE : has

    CLIENT ||--o{ SALES_ORDER : places
    CLIENT ||--|| CUSTOMER_CREDIT_ACCOUNT : has
    CLIENT ||--o{ INVOICE : billed_to

    SALES_ORDER ||--o{ SALES_ORDER_ITEM : contains
    PRODUCT ||--o{ SALES_ORDER_ITEM : sold
    USER ||--o{ SALES_ORDER : creates
    SALES_ORDER ||--o{ APPROVAL_REQUEST : requires
    SALES_ORDER ||--o{ INVOICE : generates

    INVOICE ||--o{ PAYMENT : receives
    PAYMENT_METHOD ||--o{ PAYMENT : used_by
    INVOICE ||--o{ CREDIT_NOTE : may_have
    INVOICE ||--o{ DEBIT_NOTE : may_have

    SUPPLIER ||--o{ SUPPLIER_PRODUCT : offers
    PRODUCT ||--o{ SUPPLIER_PRODUCT : supplied_as
    SUPPLIER ||--o{ PURCHASE_ORDER : receives
    PURCHASE_ORDER ||--o{ PURCHASE_ORDER_ITEM : contains
    PRODUCT ||--o{ PURCHASE_ORDER_ITEM : requested
    PURCHASE_ORDER ||--o{ PURCHASE_RECEIPT : generates

    PRODUCT ||--o{ LOT : has
    SUPPLIER ||--o{ LOT : supplies
    WAREHOUSE ||--o{ LOT : stores

    PRODUCT ||--o{ WAREHOUSE_STOCK : balanced_in
    WAREHOUSE ||--o{ WAREHOUSE_STOCK : balanced_in

    PRODUCT ||--o{ STOCK_MOVEMENT : moves
    LOT ||--o{ STOCK_MOVEMENT : traces
    WAREHOUSE ||--o{ STOCK_MOVEMENT : affects

    WAREHOUSE ||--o{ STOCK_TRANSFER : source
    WAREHOUSE ||--o{ STOCK_TRANSFER : destination
    STOCK_TRANSFER ||--o{ STOCK_MOVEMENT : generates

    STOCK_ADJUSTMENT ||--o{ STOCK_MOVEMENT : generates
    STOCK_ADJUSTMENT ||--o{ APPROVAL_REQUEST : requires
    PRODUCT ||--o{ STOCK_ALERT : triggers
    WAREHOUSE ||--o{ STOCK_ALERT : located_at

    RECIPE ||--o{ RECIPE_INGREDIENT : defines
    PRODUCT ||--o{ RECIPE_INGREDIENT : used_as_input
    RECIPE ||--o{ PRODUCT : produces

    RECIPE ||--o{ PRODUCTION_ORDER : drives
    SALES_ORDER ||--o{ PRODUCTION_ORDER : may_trigger
    PRODUCTION_ORDER ||--o{ APPROVAL_REQUEST : requires
    PRODUCTION_ORDER ||--o{ PRODUCTION_CONSUMPTION : consumes
    PRODUCT ||--o{ PRODUCTION_CONSUMPTION : input
    LOT ||--o{ PRODUCTION_CONSUMPTION : from_lot

    PRODUCTION_ORDER ||--o{ PRODUCTION_OUTPUT : outputs
    PRODUCT ||--o{ PRODUCTION_OUTPUT : output
    LOT ||--o| PRODUCTION_OUTPUT : generated_lot

    PRODUCTION_ORDER ||--o{ PRODUCTION_WASTE : records
    PRODUCT ||--o{ PRODUCTION_WASTE : wasted_item
    WASTE_REASON ||--o{ PRODUCTION_WASTE : explains

    PROMOTION ||--o{ PROMOTION_RULE : has
    PROMOTION ||--o{ PROMOTION_ITEM : includes
    PRODUCT ||--o{ PROMOTION_ITEM : discounted_or_combo

    USER ||--o{ APPROVAL_REQUEST : resolves
    USER ||--o{ AUDIT_LOG : performs
    COMPANY ||--o{ AUDIT_LOG : owns