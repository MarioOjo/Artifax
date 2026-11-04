-- Artifax demo data
--
-- Loads a small, believable workshop dataset (branches, raw materials, product blueprints,
-- branch stock, employees, and production orders with history) into a freshly migrated database.
--
-- Run once against the app's database (e.g. paste into the Aiven SQL editor and click Run).
-- Everything is one DO block, so it runs as a single statement and either fully applies or not at all.
-- Requires the pgcrypto extension (CREATE EXTENSION IF NOT EXISTS pgcrypto;).
-- Demo employees get random passwords and cannot log in; create real accounts in the app.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Items") OR EXISTS (SELECT 1 FROM "Orders") THEN
        RAISE EXCEPTION 'Items or Orders already contain data; demo seed not applied.';
    END IF;

    -- Branches (keeps any existing ones, e.g. Head Office)
    INSERT INTO "Branches" ("BranchName")
    SELECT b.name
    FROM (VALUES ('Head Office'), ('Johannesburg Workshop'), ('Cape Town Plant')) AS b(name)
    WHERE NOT EXISTS (SELECT 1 FROM "Branches" x WHERE x."BranchName" = b.name);

    -- Items: raw materials (ProductionTime 0) and craftable products (minutes per unit)
    INSERT INTO "Items" ("ItemName", "ItemCategory", "ProductionTime", "Price")
    VALUES
        ('Steel Sheet',        'Metal',        0,   185.00),
        ('Aluminium Rod',      'Metal',        0,    96.50),
        ('Copper Wire (10m)',  'Electronics',  0,    74.00),
        ('Circuit Board',      'Electronics',  0,   220.00),
        ('Ball Bearing',       'Mechanical',   0,    18.75),
        ('Screw Pack (50)',    'Mechanical',   0,    32.00),
        ('Pine Plank',         'Furniture',    0,   140.00),
        ('Plastic Pellets (1kg)', 'Plastic',   0,    55.00),
        ('Cardboard Sheet',    'Paper',        0,     9.50),
        ('Paint (1L)',         'Other',        0,   120.00),
        ('Steel Bracket',      'Metal',        5,   450.00),
        ('Plastic Casing',     'Plastic',      6,   210.00),
        ('Shipping Box',       'Paper',        2,    35.00),
        ('Gear Assembly',      'Mechanical',  12,   380.00),
        ('Electric Motor',     'Electronics', 25,  1650.00),
        ('Control Unit',       'Electronics', 20,  1240.00),
        ('Conveyor Roller',    'Mechanical',  35,  2890.00),
        ('Office Chair',       'Furniture',   30,  1450.00),
        ('Workbench',          'Furniture',   45,  3200.00);

    -- Blueprints: product <- ingredient x quantity
    INSERT INTO "ItemIngredients" ("ProductID", "IngredientID", "IngredientQuantity")
    SELECT p."ItemID", i."ItemID", r.qty
    FROM (VALUES
        ('Steel Bracket',   'Steel Sheet',           2),
        ('Steel Bracket',   'Screw Pack (50)',       1),
        ('Plastic Casing',  'Plastic Pellets (1kg)', 3),
        ('Shipping Box',    'Cardboard Sheet',       2),
        ('Gear Assembly',   'Aluminium Rod',         1),
        ('Gear Assembly',   'Ball Bearing',          2),
        ('Gear Assembly',   'Screw Pack (50)',       1),
        ('Electric Motor',  'Copper Wire (10m)',     3),
        ('Electric Motor',  'Circuit Board',         1),
        ('Electric Motor',  'Ball Bearing',          2),
        ('Electric Motor',  'Steel Bracket',         1),
        ('Control Unit',    'Circuit Board',         2),
        ('Control Unit',    'Copper Wire (10m)',     2),
        ('Control Unit',    'Plastic Casing',        1),
        ('Conveyor Roller', 'Aluminium Rod',         1),
        ('Conveyor Roller', 'Ball Bearing',          2),
        ('Conveyor Roller', 'Electric Motor',        1),
        ('Office Chair',    'Pine Plank',            2),
        ('Office Chair',    'Gear Assembly',         1),
        ('Office Chair',    'Plastic Casing',        2),
        ('Workbench',       'Pine Plank',            4),
        ('Workbench',       'Steel Bracket',         4),
        ('Workbench',       'Screw Pack (50)',       1),
        ('Workbench',       'Paint (1L)',            1)
    ) AS r(product, ingredient, qty)
    JOIN "Items" p ON p."ItemName" = r.product
    JOIN "Items" i ON i."ItemName" = r.ingredient;

    -- Stock per branch
    INSERT INTO "BranchItemCapacities" ("BranchID", "ItemID", "ItemQuantity")
    SELECT b."BranchID", i."ItemID", s.qty
    FROM (VALUES
        ('Head Office', 'Steel Sheet', 120),        ('Head Office', 'Aluminium Rod', 60),
        ('Head Office', 'Copper Wire (10m)', 85),   ('Head Office', 'Circuit Board', 40),
        ('Head Office', 'Ball Bearing', 300),       ('Head Office', 'Screw Pack (50)', 150),
        ('Head Office', 'Plastic Pellets (1kg)', 200), ('Head Office', 'Paint (1L)', 25),
        ('Head Office', 'Steel Bracket', 34),       ('Head Office', 'Electric Motor', 6),
        ('Head Office', 'Control Unit', 9),         ('Head Office', 'Plastic Casing', 18),

        ('Johannesburg Workshop', 'Steel Sheet', 75),     ('Johannesburg Workshop', 'Aluminium Rod', 90),
        ('Johannesburg Workshop', 'Ball Bearing', 420),   ('Johannesburg Workshop', 'Screw Pack (50)', 95),
        ('Johannesburg Workshop', 'Copper Wire (10m)', 30), ('Johannesburg Workshop', 'Circuit Board', 12),
        ('Johannesburg Workshop', 'Gear Assembly', 22),   ('Johannesburg Workshop', 'Conveyor Roller', 3),
        ('Johannesburg Workshop', 'Electric Motor', 4),   ('Johannesburg Workshop', 'Steel Bracket', 16),

        ('Cape Town Plant', 'Pine Plank', 160),           ('Cape Town Plant', 'Paint (1L)', 40),
        ('Cape Town Plant', 'Screw Pack (50)', 70),       ('Cape Town Plant', 'Steel Sheet', 45),
        ('Cape Town Plant', 'Cardboard Sheet', 500),      ('Cape Town Plant', 'Plastic Pellets (1kg)', 110),
        ('Cape Town Plant', 'Office Chair', 14),          ('Cape Town Plant', 'Workbench', 5),
        ('Cape Town Plant', 'Shipping Box', 260),         ('Cape Town Plant', 'Gear Assembly', 8)
    ) AS s(branch, item, qty)
    JOIN "Branches" b ON b."BranchName" = s.branch
    JOIN "Items" i ON i."ItemName" = s.item;

    -- Demo employees (fictional; random passwords, so they cannot log in)
    INSERT INTO "Employees" ("EmployeeEmail", "EmployeeName", "EmployeePasswordHash", "BranchId", "EmployeeLevel")
    SELECT e.email, e.name, crypt(gen_random_uuid()::text, gen_salt('bf', 11)), b."BranchID", 'Employee'
    FROM (VALUES
        ('thandi.nkosi@example.com',   'Thandi Nkosi',     'Head Office'),
        ('aisha.patel@example.com',    'Aisha Patel',      'Head Office'),
        ('sipho.dlamini@example.com',  'Sipho Dlamini',    'Johannesburg Workshop'),
        ('pieter.vdm@example.com',     'Pieter van der Merwe', 'Johannesburg Workshop'),
        ('lerato.mokoena@example.com', 'Lerato Mokoena',   'Cape Town Plant'),
        ('james.carter@example.com',   'James Carter',     'Cape Town Plant')
    ) AS e(email, name, branch)
    JOIN "Branches" b ON b."BranchName" = e.branch;

    -- Production orders. TotalTime = Quantity * ProductionTime (minutes); Active orders keep
    -- advancing via OrderTimeTrackingService. At most 3 Active orders per branch.
    INSERT INTO "Orders" ("ItemID", "Quantity", "CreatedDateTime", "StartedDateTime", "CompletedDateTime",
                          "TotalTime", "TimeElapsed", "BranchID", "EmployeeID", "OrderExpedite", "Status")
    SELECT i."ItemID", o.qty,
           now() - o.created_ago,
           now() - o.started_ago,
           now() - o.completed_ago,
           o.qty * i."ProductionTime",
           CASE WHEN o.status = 'Complete' THEN o.qty * i."ProductionTime"
                ELSE LEAST(o.elapsed, o.qty * i."ProductionTime" - 1) END,
           b."BranchID", e."EmployeeId", o.expedite, o.status
    FROM (VALUES
        -- branch, item, employee, qty, status, expedite, created_ago, started_ago, completed_ago, elapsed
        ('Head Office', 'Steel Bracket',  'thandi.nkosi@example.com', 20, 'Complete', false, interval '13 days', interval '13 days',            interval '12 days 22 hours', 0),
        ('Head Office', 'Electric Motor', 'aisha.patel@example.com',   4, 'Complete', true,  interval '9 days',  interval '9 days',             interval '8 days 22 hours',  0),
        ('Head Office', 'Control Unit',   'thandi.nkosi@example.com',  5, 'Complete', false, interval '6 days',  interval '5 days 20 hours',    interval '5 days 18 hours',  0),
        ('Head Office', 'Electric Motor', 'aisha.patel@example.com',   6, 'Active',   false, interval '3 hours', interval '1 hour 10 minutes', NULL,                        70),
        ('Head Office', 'Plastic Casing', 'thandi.nkosi@example.com', 15, 'Active',   true,  interval '2 hours', interval '40 minutes',        NULL,                        60),
        ('Head Office', 'Control Unit',   'aisha.patel@example.com',   8, 'Queued',   false, interval '1 hour',  NULL,                         NULL,                         0),
        ('Head Office', 'Steel Bracket',  'thandi.nkosi@example.com', 30, 'Cancelled', false, interval '4 days', NULL,                         NULL,                         0),

        ('Johannesburg Workshop', 'Gear Assembly',   'sipho.dlamini@example.com', 12, 'Complete', false, interval '11 days', interval '11 days',         interval '10 days 21 hours', 0),
        ('Johannesburg Workshop', 'Conveyor Roller', 'pieter.vdm@example.com',     3, 'Complete', false, interval '7 days',  interval '7 days',          interval '6 days 22 hours',  0),
        ('Johannesburg Workshop', 'Conveyor Roller', 'sipho.dlamini@example.com',  4, 'Active',   false, interval '5 hours', interval '2 hours',         NULL,                        95),
        ('Johannesburg Workshop', 'Gear Assembly',   'pieter.vdm@example.com',    10, 'Paused',   false, interval '1 day',   interval '22 hours',        NULL,                        48),
        ('Johannesburg Workshop', 'Steel Bracket',   'sipho.dlamini@example.com', 25, 'Queued',   true,  interval '30 minutes', NULL,                    NULL,                         0),

        ('Cape Town Plant', 'Office Chair',  'lerato.mokoena@example.com', 10, 'Complete', false, interval '12 days', interval '12 days',          interval '11 days 19 hours', 0),
        ('Cape Town Plant', 'Workbench',     'james.carter@example.com',    4, 'Complete', true,  interval '8 days',  interval '8 days',           interval '7 days 21 hours',  0),
        ('Cape Town Plant', 'Shipping Box',  'lerato.mokoena@example.com',100, 'Complete', false, interval '4 days',  interval '4 days',           interval '3 days 20 hours',  0),
        ('Cape Town Plant', 'Workbench',     'james.carter@example.com',    3, 'Active',   false, interval '4 hours', interval '1 hour 30 minutes', NULL,                       90),
        ('Cape Town Plant', 'Office Chair',  'lerato.mokoena@example.com',  6, 'Queued',   false, interval '2 hours', NULL,                         NULL,                        0),
        ('Cape Town Plant', 'Shipping Box',  'james.carter@example.com',   50, 'Cancelled', false, interval '2 days', NULL,                         NULL,                        0)
    ) AS o(branch, item, employee, qty, status, expedite, created_ago, started_ago, completed_ago, elapsed)
    JOIN "Branches" b ON b."BranchName" = o.branch
    JOIN "Items" i ON i."ItemName" = o.item
    JOIN "Employees" e ON e."EmployeeEmail" = o.employee;

    -- Order history, derived from each order's status and timestamps
    INSERT INTO "OrderHistories" ("OrderID", "PreviousStatus", "NewStatus", "ChangedDateTime", "ChangedByEmployeeID", "ChangeReason")
    SELECT "OrderID", 'Queued', 'Active', "StartedDateTime", "EmployeeID", 'Production started'
    FROM "Orders" WHERE "StartedDateTime" IS NOT NULL;

    INSERT INTO "OrderHistories" ("OrderID", "PreviousStatus", "NewStatus", "ChangedDateTime", "ChangedByEmployeeID", "ChangeReason")
    SELECT "OrderID", 'Active', 'Complete', "CompletedDateTime", NULL,
           'Auto-completed by background service (elapsed time reached total time)'
    FROM "Orders" WHERE "Status" = 'Complete';

    INSERT INTO "OrderHistories" ("OrderID", "PreviousStatus", "NewStatus", "ChangedDateTime", "ChangedByEmployeeID", "ChangeReason")
    SELECT "OrderID", 'Active', 'Paused', "StartedDateTime" + interval '48 minutes', "EmployeeID", 'Waiting on bearing delivery'
    FROM "Orders" WHERE "Status" = 'Paused';

    INSERT INTO "OrderHistories" ("OrderID", "PreviousStatus", "NewStatus", "ChangedDateTime", "ChangedByEmployeeID", "ChangeReason")
    SELECT "OrderID", 'Queued', 'Cancelled', "CreatedDateTime" + interval '3 hours', "EmployeeID", 'Customer cancelled'
    FROM "Orders" WHERE "Status" = 'Cancelled';
END $$;
