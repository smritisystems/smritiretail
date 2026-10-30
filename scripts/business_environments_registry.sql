-- Master registry: business_environments
-- Purpose: defines the supply-chain operating context across distributor, wholesaler, and retailer tiers.

CREATE TABLE IF NOT EXISTS business_environments (
    environment_code VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(150) NOT NULL,
    market_type VARCHAR(50) NOT NULL,
    operational_scale VARCHAR(50) NOT NULL,
    fulfillment_role TEXT NOT NULL
);

INSERT INTO business_environments (
    environment_code,
    display_name,
    market_type,
    operational_scale,
    fulfillment_role
) VALUES
    (
        'DISTRIBUTOR',
        'Distributor',
        'B2B',
        'Macro Bulk',
        'Manages regional logistics, high-volume factory sourcing, and brand promotion.'
    ),
    (
        'WHOLESALER',
        'Wholesaler',
        'B2B',
        'Micro Bulk',
        'Breaks down bulk shipments into smaller case lots for local business resale.'
    ),
    (
        'RETAILER',
        'Retailer',
        'B2C',
        'Unit Retail',
        'Sells individual units directly to the end consumer via storefronts or e-commerce.'
    )
ON CONFLICT (environment_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    market_type = EXCLUDED.market_type,
    operational_scale = EXCLUDED.operational_scale,
    fulfillment_role = EXCLUDED.fulfillment_role;

SELECT * FROM business_environments ORDER BY environment_code;
