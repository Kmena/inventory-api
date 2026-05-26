CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_id VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id),
    role_id BIGINT REFERENCES roles(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone VARCHAR(50),
    status SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE regions (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id),
    name VARCHAR(120) NOT NULL,
    route_code VARCHAR(50)
);

CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    region_id BIGINT REFERENCES regions(id),
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    legal_id VARCHAR(100),
    document_type SMALLINT,
    email_billing VARCHAR(255),
    email_courtesy VARCHAR(255),
    address TEXT,
    province VARCHAR(120),
    canton VARCHAR(120),
    district VARCHAR(120),
    payment_type VARCHAR(50),
    payment_days INTEGER,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    visit_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_contacts (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(120),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50)
);

CREATE TABLE inventories (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL UNIQUE REFERENCES companies(id)
);

CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category_type VARCHAR(50) DEFAULT 'PT',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recipes (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    recipe_type SMALLINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    category_id BIGINT REFERENCES categories(id),
    recipe_id BIGINT REFERENCES recipes(id),
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(30) DEFAULT 'KG',
    currency VARCHAR(10) DEFAULT 'CRC',
    price NUMERIC(14,2),
    quantity NUMERIC(14,3) DEFAULT 0,
    reserved_quantity NUMERIC(14,3) DEFAULT 0,
    tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    in_catalog BOOLEAN NOT NULL DEFAULT FALSE,
    net_content NUMERIC(14,3) DEFAULT 0,
    conversion_factor NUMERIC(14,6) DEFAULT 1,
    min_stock NUMERIC(14,3),
    max_stock NUMERIC(14,3),
    standby_stock NUMERIC(14,3) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    client_id BIGINT REFERENCES clients(id),
    user_id BIGINT REFERENCES users(id),
    receipt_number VARCHAR(80),
    invoice_number VARCHAR(80),
    notes TEXT,
    responsible VARCHAR(255),
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMP,
    approved_by BIGINT REFERENCES users(id),
    is_cash BOOLEAN NOT NULL DEFAULT FALSE,
    down_payment NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    other_costs NUMERIC(14,2) NOT NULL DEFAULT 0,
    transport VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity NUMERIC(14,3) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    approved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE invoices (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    order_id BIGINT REFERENCES orders(id),
    number VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    payment_method VARCHAR(50),
    reference VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_clients_company_id ON clients(company_id);
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_orders_company_id ON orders(company_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
