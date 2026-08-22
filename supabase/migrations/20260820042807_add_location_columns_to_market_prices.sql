-- Add location columns to market_prices for location-based real-time prices
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS state text DEFAULT '';
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS district text DEFAULT '';
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS source text DEFAULT 'AI';
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS latitude numeric(10,6);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS longitude numeric(10,6);

-- Update policy to allow update (for refreshing prices)
DROP POLICY IF EXISTS "mp_update_all" ON market_prices;
CREATE POLICY "mp_update_all" ON market_prices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
