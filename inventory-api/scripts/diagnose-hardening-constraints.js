const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

const DIAGNOSTIC_QUERIES = [
  {
    key: 'payments_active_with_reversal_metadata',
    description: 'Pagos ACTIVE con metadata de reversión no nula.',
    query: Prisma.sql`
      SELECT id
      FROM payments
      WHERE status = 'ACTIVE'
        AND (
          reversed_at IS NOT NULL
          OR reversal_reason IS NOT NULL
          OR reversed_by_user_id IS NOT NULL
        )
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'payments_reversed_missing_metadata',
    description: 'Pagos REVERSED sin reversed_at o reversal_reason.',
    query: Prisma.sql`
      SELECT id
      FROM payments
      WHERE status = 'REVERSED'
        AND (
          reversed_at IS NULL
          OR reversal_reason IS NULL
        )
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'orders_not_approved_with_metadata',
    description: 'Pedidos no aprobados con approved_at o approved_by_id presentes.',
    query: Prisma.sql`
      SELECT id
      FROM orders
      WHERE approved = false
        AND (
          approved_at IS NOT NULL
          OR approved_by_id IS NOT NULL
        )
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'orders_approved_missing_metadata',
    description: 'Pedidos aprobados sin approved_at o approved_by_id.',
    query: Prisma.sql`
      SELECT id
      FROM orders
      WHERE approved = true
        AND (
          approved_at IS NULL
          OR approved_by_id IS NULL
        )
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'orders_status_approved_without_flag',
    description: 'Pedidos con status APPROVED pero approved = false.',
    query: Prisma.sql`
      SELECT id
      FROM orders
      WHERE status = 'APPROVED'
        AND approved = false
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'orders_approved_with_invalid_status',
    description: 'Pedidos aprobados con estados distintos de APPROVED o DELIVERED.',
    query: Prisma.sql`
      SELECT id
      FROM orders
      WHERE approved = true
        AND status NOT IN ('APPROVED', 'DELIVERED')
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'payments_negative_amount',
    description: 'Pagos con amount negativo.',
    query: Prisma.sql`SELECT id FROM payments WHERE amount < 0 ORDER BY id LIMIT 20`,
  },
  {
    key: 'invoices_negative_amount',
    description: 'Facturas con amount negativo.',
    query: Prisma.sql`SELECT id FROM invoices WHERE amount < 0 ORDER BY id LIMIT 20`,
  },
  {
    key: 'orders_negative_amounts',
    description: 'Pedidos con down_payment, total u other_costs negativos.',
    query: Prisma.sql`
      SELECT id
      FROM orders
      WHERE down_payment < 0
        OR total < 0
        OR other_costs < 0
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'order_items_negative_values',
    description: 'Líneas de pedido con quantity o descuentos/precios negativos.',
    query: Prisma.sql`
      SELECT id
      FROM order_items
      WHERE quantity < 0
        OR unit_price < 0
        OR discount_percent < 0
        OR discount_amount < 0
        OR total_discount < 0
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'lots_negative_quantities',
    description: 'Lotes con quantity u original_quantity negativos.',
    query: Prisma.sql`
      SELECT id
      FROM lots
      WHERE quantity < 0
        OR original_quantity < 0
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'warehouse_stocks_negative_or_reserved_gt_quantity',
    description: 'WarehouseStock con quantity/reserved_quantity negativos o reserved_quantity > quantity.',
    query: Prisma.sql`
      SELECT id
      FROM warehouse_stocks
      WHERE quantity < 0
        OR reserved_quantity < 0
        OR reserved_quantity > quantity
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'warehouse_lot_stocks_negative_or_reserved_gt_quantity',
    description: 'WarehouseLotStock con quantity/reserved_quantity negativos o reserved_quantity > quantity.',
    query: Prisma.sql`
      SELECT id
      FROM warehouse_lot_stocks
      WHERE quantity < 0
        OR reserved_quantity < 0
        OR reserved_quantity > quantity
      ORDER BY id
      LIMIT 20
    `,
  },
  {
    key: 'products_negative_or_reserved_gt_quantity',
    description: 'Productos con quantity/reserved_quantity negativos o reserved_quantity > quantity.',
    query: Prisma.sql`
      SELECT id
      FROM products
      WHERE quantity < 0
        OR reserved_quantity < 0
        OR reserved_quantity > quantity
      ORDER BY id
      LIMIT 20
    `,
  },
];

async function runDiagnostic() {
  const results = [];

  for (const diagnostic of DIAGNOSTIC_QUERIES) {
    const rows = await prisma.$queryRaw(diagnostic.query);
    results.push({
      key: diagnostic.key,
      description: diagnostic.description,
      count: Array.isArray(rows) ? rows.length : 0,
      sampleIds: Array.isArray(rows) ? rows.map((row) => String(row.id)) : [],
    });
  }

  return results;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio para ejecutar el diagnóstico de hardening.');
  }

  const results = await runDiagnostic();
  const invalidResults = results.filter((result) => result.count > 0);

  console.log(JSON.stringify({
    ok: invalidResults.length === 0,
    diagnostics: results,
  }, null, 2));

  if (invalidResults.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
