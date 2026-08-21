-- Landing permissions: insert root.access and agent.access
-- warehouse.access already exists; no insert needed for it.
-- These are data-only inserts — no schema change required.

-- Insert root.access (idempotent)
INSERT INTO permissions (code, module, action, description, is_active, created_at, updated_at)
SELECT 'root.access', 'landing', 'access', 'Acceso al panel administrativo (/root/)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'root.access');

-- Insert agent.access (idempotent)
INSERT INTO permissions (code, module, action, description, is_active, created_at, updated_at)
SELECT 'agent.access', 'landing', 'access', 'Acceso al espacio de agente comercial (/agent/)', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'agent.access');
