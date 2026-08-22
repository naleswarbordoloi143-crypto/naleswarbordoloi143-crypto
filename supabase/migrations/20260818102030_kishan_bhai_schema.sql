/*
# Kishan Bhai - Core Schema

Full schema for the Kishan Bhai digital farming platform.
Tables: profiles, villages, farms, crops, farm_crops, farm_clusters, cluster_members,
bulk_orders, bulk_order_items, machinery, machinery_bookings, harvests, harvest_lots,
harvest_contributions, collection_centers, collection_slots, quality_assessments,
buyer_requirements, buyer_offers, buyer_orders, farm_expenses, farm_productions,
farm_sales, reward_transactions, notifications, chat_groups, chat_members, chat_messages,
ai_conversations, ai_messages, ai_analyses, weather_alerts, market_prices, price_predictions,
complaints, audit_logs.
RLS enabled on all tables. App requires sign-in.
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('farmer','champion','buyer','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bulk_status AS ENUM ('REQUESTED','OPEN','CONFIRMED','ORDERED','DELIVERED','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('PENDING','ACCEPTED','REJECTED','COUNTERED','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE offer_status AS ENUM ('PENDING','ACCEPTED','REJECTED','COUNTERED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE machinery_type AS ENUM ('Tractor','Harvester','Seeder','Sprayer','Rotavator','Cultivator','Other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE chat_message_type AS ENUM ('text','image','announcement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE expense_category AS ENUM ('Seeds','Fertilizer','Pesticides','Labour','Machinery','Irrigation','Other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('Weather','Harvest','Orders','Machinery','Buyer','Payment','Reward','Reminder','System'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'farmer',
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '', email text DEFAULT '', village text DEFAULT '',
  district text DEFAULT '', state text DEFAULT '', preferred_language text DEFAULT 'en',
  avatar_url text DEFAULT '', points_balance int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles; CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles; CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles; CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_select_all" ON profiles; CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  district text DEFAULT '', state text DEFAULT '', pincode text DEFAULT '',
  latitude float8 DEFAULT NULL, longitude float8 DEFAULT NULL,
  champion_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "villages_select_all" ON villages; CREATE POLICY "villages_select_all" ON villages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "villages_insert_all" ON villages; CREATE POLICY "villages_insert_all" ON villages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "villages_update_all" ON villages; CREATE POLICY "villages_update_all" ON villages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  village_id uuid REFERENCES villages(id) ON DELETE SET NULL,
  name text DEFAULT 'My Farm', size_acres numeric(10,2) NOT NULL DEFAULT 0,
  location text DEFAULT '', latitude float8 DEFAULT NULL, longitude float8 DEFAULT NULL,
  soil_type text DEFAULT '', irrigation_source text DEFAULT '',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farms_select_all" ON farms; CREATE POLICY "farms_select_all" ON farms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "farms_insert_own" ON farms; CREATE POLICY "farms_insert_own" ON farms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "farms_update_own" ON farms; CREATE POLICY "farms_update_own" ON farms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "farms_delete_own" ON farms; CREATE POLICY "farms_delete_own" ON farms FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS crops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  category text DEFAULT '', season text DEFAULT '', unit text DEFAULT 'kg', created_at timestamptz DEFAULT now()
);
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crops_select_all" ON crops; CREATE POLICY "crops_select_all" ON crops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "crops_insert_all" ON crops; CREATE POLICY "crops_insert_all" ON crops FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "crops_update_all" ON crops; CREATE POLICY "crops_update_all" ON crops FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS farm_crops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_id uuid REFERENCES crops(id) ON DELETE SET NULL,
  crop_name text DEFAULT '', area_acres numeric(10,2) DEFAULT 0,
  planting_date date DEFAULT NULL, expected_harvest_date date DEFAULT NULL,
  expected_yield_kg numeric(12,2) DEFAULT 0, status text DEFAULT 'planted', created_at timestamptz DEFAULT now()
);
ALTER TABLE farm_crops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farm_crops_select_all" ON farm_crops; CREATE POLICY "farm_crops_select_all" ON farm_crops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "farm_crops_insert_own" ON farm_crops; CREATE POLICY "farm_crops_insert_own" ON farm_crops FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()));
DROP POLICY IF EXISTS "farm_crops_update_own" ON farm_crops; CREATE POLICY "farm_crops_update_own" ON farm_crops FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()));
DROP POLICY IF EXISTS "farm_crops_delete_own" ON farm_crops; CREATE POLICY "farm_crops_delete_own" ON farm_crops FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM farms WHERE farms.id = farm_crops.farm_id AND farms.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS farm_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  village_id uuid REFERENCES villages(id) ON DELETE SET NULL, crop_name text DEFAULT '',
  champion_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_harvest_date date DEFAULT NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE farm_clusters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clusters_select_all" ON farm_clusters; CREATE POLICY "clusters_select_all" ON farm_clusters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "clusters_insert_all" ON farm_clusters; CREATE POLICY "clusters_insert_all" ON farm_clusters FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "clusters_update_all" ON farm_clusters; CREATE POLICY "clusters_update_all" ON farm_clusters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS cluster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES farm_clusters(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(), UNIQUE (cluster_id, farm_id)
);
ALTER TABLE cluster_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_select_all" ON cluster_members; CREATE POLICY "cm_select_all" ON cluster_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cm_insert_own" ON cluster_members; CREATE POLICY "cm_insert_own" ON cluster_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cm_delete_own" ON cluster_members; CREATE POLICY "cm_delete_own" ON cluster_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS bulk_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, item_name text NOT NULL,
  category text DEFAULT '', unit text DEFAULT 'kg', target_quantity numeric(12,2) NOT NULL DEFAULT 0,
  estimated_bulk_price numeric(12,2) DEFAULT 0, individual_price numeric(12,2) DEFAULT 0,
  cluster_id uuid REFERENCES farm_clusters(id) ON DELETE SET NULL,
  village_id uuid REFERENCES villages(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status bulk_status NOT NULL DEFAULT 'REQUESTED', notes text DEFAULT '',
  closes_on date DEFAULT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE bulk_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bo_select_all" ON bulk_orders; CREATE POLICY "bo_select_all" ON bulk_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bo_insert_own" ON bulk_orders; CREATE POLICY "bo_insert_own" ON bulk_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "bo_update_own" ON bulk_orders; CREATE POLICY "bo_update_own" ON bulk_orders FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "bo_delete_own" ON bulk_orders; CREATE POLICY "bo_delete_own" ON bulk_orders FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS bulk_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_order_id uuid NOT NULL REFERENCES bulk_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity numeric(12,2) NOT NULL DEFAULT 0, notes text DEFAULT '',
  created_at timestamptz DEFAULT now(), UNIQUE (bulk_order_id, user_id)
);
ALTER TABLE bulk_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boi_select_all" ON bulk_order_items; CREATE POLICY "boi_select_all" ON bulk_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "boi_insert_own" ON bulk_order_items; CREATE POLICY "boi_insert_own" ON bulk_order_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "boi_update_own" ON bulk_order_items; CREATE POLICY "boi_update_own" ON bulk_order_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "boi_delete_own" ON bulk_order_items; CREATE POLICY "boi_delete_own" ON bulk_order_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS machinery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  type machinery_type NOT NULL DEFAULT 'Tractor',
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  village_id uuid REFERENCES villages(id) ON DELETE SET NULL, location text DEFAULT '',
  price_per_hour numeric(10,2) NOT NULL DEFAULT 0, image_url text DEFAULT '',
  is_available boolean NOT NULL DEFAULT true, rating numeric(3,1) DEFAULT 0, created_at timestamptz DEFAULT now()
);
ALTER TABLE machinery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mach_select_all" ON machinery; CREATE POLICY "mach_select_all" ON machinery FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mach_insert_own" ON machinery; CREATE POLICY "mach_insert_own" ON machinery FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "mach_update_own" ON machinery; CREATE POLICY "mach_update_own" ON machinery FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "mach_delete_own" ON machinery; CREATE POLICY "mach_delete_own" ON machinery FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS machinery_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id uuid NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_date date NOT NULL, start_time text NOT NULL DEFAULT '08:00', end_time text NOT NULL DEFAULT '10:00',
  location text DEFAULT '', total_price numeric(10,2) DEFAULT 0,
  status text DEFAULT 'PENDING', notes text DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE machinery_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mb_select_all" ON machinery_bookings; CREATE POLICY "mb_select_all" ON machinery_bookings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mb_insert_own" ON machinery_bookings; CREATE POLICY "mb_insert_own" ON machinery_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "mb_update_own" ON machinery_bookings; CREATE POLICY "mb_update_own" ON machinery_bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM machinery WHERE machinery.id = machinery_bookings.machinery_id AND machinery.owner_id = auth.uid())) WITH CHECK (true);
DROP POLICY IF EXISTS "mb_delete_own" ON machinery_bookings; CREATE POLICY "mb_delete_own" ON machinery_bookings FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS harvests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_name text NOT NULL, expected_quantity_kg numeric(12,2) NOT NULL DEFAULT 0,
  harvest_date date DEFAULT NULL, quality_grade text DEFAULT '', location text DEFAULT '',
  status text DEFAULT 'EXPECTED', created_at timestamptz DEFAULT now()
);
ALTER TABLE harvests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "harv_select_all" ON harvests; CREATE POLICY "harv_select_all" ON harvests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "harv_insert_own" ON harvests; CREATE POLICY "harv_insert_own" ON harvests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "harv_update_own" ON harvests; CREATE POLICY "harv_update_own" ON harvests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "harv_delete_own" ON harvests; CREATE POLICY "harv_delete_own" ON harvests FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS harvest_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crop_name text NOT NULL,
  cluster_id uuid REFERENCES farm_clusters(id) ON DELETE SET NULL,
  total_quantity_kg numeric(12,2) NOT NULL DEFAULT 0, quality_grade text DEFAULT '',
  harvest_date date DEFAULT NULL, location text DEFAULT '', price_per_kg numeric(10,2) DEFAULT 0,
  status text DEFAULT 'OPEN', created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE harvest_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hl_select_all" ON harvest_lots; CREATE POLICY "hl_select_all" ON harvest_lots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "hl_insert_own" ON harvest_lots; CREATE POLICY "hl_insert_own" ON harvest_lots FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "hl_update_own" ON harvest_lots; CREATE POLICY "hl_update_own" ON harvest_lots FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "hl_delete_own" ON harvest_lots; CREATE POLICY "hl_delete_own" ON harvest_lots FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS harvest_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES harvest_lots(id) ON DELETE CASCADE,
  harvest_id uuid REFERENCES harvests(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity_kg numeric(12,2) NOT NULL DEFAULT 0, quality_grade text DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE harvest_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hc_select_all" ON harvest_contributions; CREATE POLICY "hc_select_all" ON harvest_contributions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "hc_insert_own" ON harvest_contributions; CREATE POLICY "hc_insert_own" ON harvest_contributions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "hc_update_own" ON harvest_contributions; CREATE POLICY "hc_update_own" ON harvest_contributions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "hc_delete_own" ON harvest_contributions; CREATE POLICY "hc_delete_own" ON harvest_contributions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS collection_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  village_id uuid REFERENCES villages(id) ON DELETE SET NULL, address text DEFAULT '',
  latitude float8 DEFAULT NULL, longitude float8 DEFAULT NULL,
  opening_hours text DEFAULT '9:00-17:00', capacity_kg numeric(12,2) DEFAULT 0,
  contact_phone text DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE collection_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc_select_all" ON collection_centers; CREATE POLICY "cc_select_all" ON collection_centers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cc_insert_all" ON collection_centers; CREATE POLICY "cc_insert_all" ON collection_centers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cc_update_all" ON collection_centers; CREATE POLICY "cc_update_all" ON collection_centers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS collection_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES collection_centers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_date date NOT NULL, slot_time text NOT NULL DEFAULT '09:00',
  crop_name text DEFAULT '', quantity_kg numeric(12,2) DEFAULT 0,
  status text DEFAULT 'BOOKED', created_at timestamptz DEFAULT now(),
  UNIQUE (center_id, slot_date, slot_time)
);
ALTER TABLE collection_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_select_all" ON collection_slots; CREATE POLICY "cs_select_all" ON collection_slots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cs_insert_own" ON collection_slots; CREATE POLICY "cs_insert_own" ON collection_slots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cs_delete_own" ON collection_slots; CREATE POLICY "cs_delete_own" ON collection_slots FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS quality_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid REFERENCES harvest_contributions(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES harvest_lots(id) ON DELETE CASCADE,
  assessed_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  moisture_pct numeric(5,2) DEFAULT 0, cleanliness_pct numeric(5,2) DEFAULT 0, defects_pct numeric(5,2) DEFAULT 0,
  grade text DEFAULT '', ai_observations text DEFAULT '', human_verified boolean NOT NULL DEFAULT false,
  score numeric(5,2) DEFAULT 0, created_at timestamptz DEFAULT now()
);
ALTER TABLE quality_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "qa_select_all" ON quality_assessments; CREATE POLICY "qa_select_all" ON quality_assessments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "qa_insert_all" ON quality_assessments; CREATE POLICY "qa_insert_all" ON quality_assessments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "qa_update_all" ON quality_assessments; CREATE POLICY "qa_update_all" ON quality_assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS buyer_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_name text NOT NULL, quantity_kg numeric(12,2) NOT NULL DEFAULT 0,
  max_price_per_kg numeric(10,2) DEFAULT 0, quality_grade text DEFAULT '',
  delivery_date date DEFAULT NULL, delivery_location text DEFAULT '', notes text DEFAULT '',
  status text DEFAULT 'OPEN', created_at timestamptz DEFAULT now()
);
ALTER TABLE buyer_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "br_select_all" ON buyer_requirements; CREATE POLICY "br_select_all" ON buyer_requirements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "br_insert_own" ON buyer_requirements; CREATE POLICY "br_insert_own" ON buyer_requirements FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "br_update_own" ON buyer_requirements; CREATE POLICY "br_update_own" ON buyer_requirements FOR UPDATE TO authenticated USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "br_delete_own" ON buyer_requirements; CREATE POLICY "br_delete_own" ON buyer_requirements FOR DELETE TO authenticated USING (auth.uid() = buyer_id);

CREATE TABLE IF NOT EXISTS buyer_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES buyer_requirements(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES harvest_lots(id) ON DELETE CASCADE,
  price_per_kg numeric(10,2) NOT NULL DEFAULT 0, quantity_kg numeric(12,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '', status offer_status NOT NULL DEFAULT 'PENDING', created_at timestamptz DEFAULT now()
);
ALTER TABLE buyer_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bof_select_all" ON buyer_offers; CREATE POLICY "bof_select_all" ON buyer_offers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bof_insert_own" ON buyer_offers; CREATE POLICY "bof_insert_own" ON buyer_offers FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "bof_update_all" ON buyer_offers; CREATE POLICY "bof_update_all" ON buyer_offers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS buyer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farmer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES harvest_lots(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES buyer_offers(id) ON DELETE SET NULL,
  crop_name text NOT NULL, quantity_kg numeric(12,2) NOT NULL DEFAULT 0,
  price_per_kg numeric(10,2) NOT NULL DEFAULT 0, total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'PENDING', delivery_date date DEFAULT NULL,
  delivery_location text DEFAULT '', notes text DEFAULT '',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE buyer_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bord_select_all" ON buyer_orders; CREATE POLICY "bord_select_all" ON buyer_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bord_insert_own" ON buyer_orders; CREATE POLICY "bord_insert_own" ON buyer_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "bord_update_all" ON buyer_orders; CREATE POLICY "bord_update_all" ON buyer_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS farm_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES farms(id) ON DELETE SET NULL,
  category expense_category NOT NULL DEFAULT 'Other', description text DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0, expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE farm_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fe_select_own" ON farm_expenses; CREATE POLICY "fe_select_own" ON farm_expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fe_insert_own" ON farm_expenses; CREATE POLICY "fe_insert_own" ON farm_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fe_update_own" ON farm_expenses; CREATE POLICY "fe_update_own" ON farm_expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fe_delete_own" ON farm_expenses; CREATE POLICY "fe_delete_own" ON farm_expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS farm_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES farms(id) ON DELETE SET NULL, crop_name text NOT NULL,
  quantity_kg numeric(12,2) NOT NULL DEFAULT 0, production_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE farm_productions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fp_select_own" ON farm_productions; CREATE POLICY "fp_select_own" ON farm_productions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fp_insert_own" ON farm_productions; CREATE POLICY "fp_insert_own" ON farm_productions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fp_update_own" ON farm_productions; CREATE POLICY "fp_update_own" ON farm_productions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fp_delete_own" ON farm_productions; CREATE POLICY "fp_delete_own" ON farm_productions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS farm_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_name text NOT NULL, quantity_kg numeric(12,2) NOT NULL DEFAULT 0,
  price_per_kg numeric(10,2) NOT NULL DEFAULT 0, total_amount numeric(12,2) NOT NULL DEFAULT 0,
  buyer_name text DEFAULT '', sale_date date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz DEFAULT now()
);
ALTER TABLE farm_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fs_select_own" ON farm_sales; CREATE POLICY "fs_select_own" ON farm_sales FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fs_insert_own" ON farm_sales; CREATE POLICY "fs_insert_own" ON farm_sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fs_update_own" ON farm_sales; CREATE POLICY "fs_update_own" ON farm_sales FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fs_delete_own" ON farm_sales; CREATE POLICY "fs_delete_own" ON farm_sales FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  points int NOT NULL DEFAULT 0, reason text NOT NULL DEFAULT '', type text NOT NULL DEFAULT 'EARNED',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rt_select_own" ON reward_transactions; CREATE POLICY "rt_select_own" ON reward_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "rt_insert_own" ON reward_transactions; CREATE POLICY "rt_insert_own" ON reward_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rt_delete_own" ON reward_transactions; CREATE POLICY "rt_delete_own" ON reward_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'System', title text NOT NULL DEFAULT '', body text DEFAULT '',
  is_read boolean NOT NULL DEFAULT false, link text DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nt_select_own" ON notifications; CREATE POLICY "nt_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "nt_insert_own" ON notifications; CREATE POLICY "nt_insert_own" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "nt_update_own" ON notifications; CREATE POLICY "nt_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "nt_delete_own" ON notifications; CREATE POLICY "nt_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text DEFAULT '',
  village_id uuid REFERENCES villages(id) ON DELETE SET NULL,
  cluster_id uuid REFERENCES farm_clusters(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cg_select_all" ON chat_groups; CREATE POLICY "cg_select_all" ON chat_groups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cg_insert_own" ON chat_groups; CREATE POLICY "cg_insert_own" ON chat_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "cg_update_own" ON chat_groups; CREATE POLICY "cg_update_own" ON chat_groups FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "cg_delete_own" ON chat_groups; CREATE POLICY "cg_delete_own" ON chat_groups FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member', joined_at timestamptz DEFAULT now(), UNIQUE (group_id, user_id)
);
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cmem_select_all" ON chat_members; CREATE POLICY "cmem_select_all" ON chat_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cmem_insert_own" ON chat_members; CREATE POLICY "cmem_insert_own" ON chat_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cmem_delete_own" ON chat_members; CREATE POLICY "cmem_delete_own" ON chat_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type chat_message_type NOT NULL DEFAULT 'text', content text DEFAULT '', image_url text DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cmsg_select_all" ON chat_messages; CREATE POLICY "cmsg_select_all" ON chat_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cmsg_insert_own" ON chat_messages; CREATE POLICY "cmsg_insert_own" ON chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cmsg_update_own" ON chat_messages; CREATE POLICY "cmsg_update_own" ON chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cmsg_delete_own" ON chat_messages; CREATE POLICY "cmsg_delete_own" ON chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'New Conversation', language text DEFAULT 'en', created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ac_select_own" ON ai_conversations; CREATE POLICY "ac_select_own" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ac_insert_own" ON ai_conversations; CREATE POLICY "ac_insert_own" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ac_delete_own" ON ai_conversations; CREATE POLICY "ac_delete_own" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user', content text NOT NULL DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "am_select_own" ON ai_messages; CREATE POLICY "am_select_own" ON ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()));
DROP POLICY IF EXISTS "am_insert_own" ON ai_messages; CREATE POLICY "am_insert_own" ON ai_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL DEFAULT '', crop text DEFAULT '', issue text DEFAULT '',
  confidence numeric(5,2) DEFAULT 0, symptoms text DEFAULT '', suggested_actions text DEFAULT '',
  prevention text DEFAULT '', advisory_note text DEFAULT 'AI analysis is advisory and should be verified by an agricultural expert for serious crop problems.',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aa_select_own" ON ai_analyses; CREATE POLICY "aa_select_own" ON ai_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "aa_insert_own" ON ai_analyses; CREATE POLICY "aa_insert_own" ON ai_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "aa_delete_own" ON ai_analyses; CREATE POLICY "aa_delete_own" ON ai_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS weather_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  village_id uuid REFERENCES villages(id) ON DELETE CASCADE,
  alert_type text DEFAULT '', severity text DEFAULT 'info', title text NOT NULL DEFAULT '',
  description text DEFAULT '', alert_date date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz DEFAULT now()
);
ALTER TABLE weather_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wa_select_all" ON weather_alerts; CREATE POLICY "wa_select_all" ON weather_alerts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "wa_insert_all" ON weather_alerts; CREATE POLICY "wa_insert_all" ON weather_alerts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "wa_delete_all" ON weather_alerts; CREATE POLICY "wa_delete_all" ON weather_alerts FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crop_name text NOT NULL,
  price_per_kg numeric(10,2) NOT NULL DEFAULT 0, market text DEFAULT '',
  recorded_date date NOT NULL DEFAULT CURRENT_DATE, is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mp_select_all" ON market_prices; CREATE POLICY "mp_select_all" ON market_prices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mp_insert_all" ON market_prices; CREATE POLICY "mp_insert_all" ON market_prices FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS price_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crop_name text NOT NULL,
  current_price numeric(10,2) DEFAULT 0, predicted_price numeric(10,2) DEFAULT 0,
  trend text DEFAULT 'stable', horizon_days int DEFAULT 30, confidence numeric(5,2) DEFAULT 0,
  reasoning text DEFAULT '', advisory_note text DEFAULT 'AI estimate — not a guaranteed price.',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE price_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_select_all" ON price_predictions; CREATE POLICY "pp_select_all" ON price_predictions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pp_insert_all" ON price_predictions; CREATE POLICY "pp_insert_all" ON price_predictions FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '', description text DEFAULT '', category text DEFAULT 'general',
  status text DEFAULT 'OPEN', resolution text DEFAULT '', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cp_select_own" ON complaints; CREATE POLICY "cp_select_own" ON complaints FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_insert_own" ON complaints; CREATE POLICY "cp_insert_own" ON complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cp_update_own" ON complaints; CREATE POLICY "cp_update_own" ON complaints FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '', entity text DEFAULT '', entity_id uuid DEFAULT NULL,
  details text DEFAULT '', created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "al_select_all" ON audit_logs; CREATE POLICY "al_select_all" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "al_insert_all" ON audit_logs; CREATE POLICY "al_insert_all" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_farms_user ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_crops_farm ON farm_crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_order ON bulk_order_items(bulk_order_id);
CREATE INDEX IF NOT EXISTS idx_machinery_bookings_machine ON machinery_bookings(machinery_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_harvest_contributions_lot ON harvest_contributions(lot_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON chat_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_farm_expenses_user ON farm_expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_market_prices_crop ON market_prices(crop_name, recorded_date);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_buyer ON buyer_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
