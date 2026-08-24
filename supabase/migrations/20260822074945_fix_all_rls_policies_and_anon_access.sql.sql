-- =====================================================
-- 1. Revoke ALL privileges from anon role on every table
--    The app uses authenticated users only (sign-in required).
--    anon should have no access to any table.
-- =====================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- =====================================================
-- 2. Add missing RLS policies
--    Pattern: ownership-based for user tables, admin-only for shared/reference tables
-- =====================================================

-- ai_analyses: missing UPDATE
CREATE POLICY "aa_update_own" ON ai_analyses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_conversations: missing UPDATE
CREATE POLICY "ac_update_own" ON ai_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_messages: missing UPDATE, DELETE (ownership via conversation)
CREATE POLICY "am_update_own" ON ai_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()));

CREATE POLICY "am_delete_own" ON ai_messages FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND ai_conversations.user_id = auth.uid()));

-- audit_logs: missing UPDATE, DELETE — admin only (logs should be immutable to non-admins)
-- No UPDATE/DELETE for regular users; admin can manage
CREATE POLICY "al_update_admin" ON audit_logs FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

CREATE POLICY "al_delete_admin" ON audit_logs FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- buyer_offers: missing DELETE — buyer can delete own offers
CREATE POLICY "bof_delete_own" ON buyer_offers FOR DELETE
  TO authenticated USING (auth.uid() = buyer_id);

-- buyer_orders: missing DELETE — buyer or farmer can delete
CREATE POLICY "bord_delete_own" ON buyer_orders FOR DELETE
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = farmer_id);

-- chat_members: missing UPDATE — user can update own membership
CREATE POLICY "cmem_update_own" ON chat_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cluster_members: missing UPDATE — user can update own membership
CREATE POLICY "cm_update_own" ON cluster_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- collection_centers: missing DELETE — admin only
CREATE POLICY "cc_delete_admin" ON collection_centers FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- collection_slots: missing UPDATE — user can update own slots
CREATE POLICY "cs_update_own" ON collection_slots FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- complaints: missing DELETE — user can delete own, admin can delete any
CREATE POLICY "cp_delete_own" ON complaints FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "cp_delete_admin" ON complaints FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- crops: missing DELETE — admin only (reference data)
CREATE POLICY "crops_delete_admin" ON crops FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- farm_clusters: missing DELETE — admin or champion who created it
CREATE POLICY "clusters_delete_admin" ON farm_clusters FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- market_prices: missing DELETE — admin only
CREATE POLICY "mp_delete_admin" ON market_prices FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- price_predictions: missing UPDATE, DELETE — admin only
CREATE POLICY "pp_update_admin" ON price_predictions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

CREATE POLICY "pp_delete_admin" ON price_predictions FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- profiles: missing DELETE — admin only (users shouldn't delete their own profile row directly)
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- quality_assessments: missing DELETE — admin only
CREATE POLICY "qa_delete_admin" ON quality_assessments FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- reward_transactions: missing UPDATE — admin only (users shouldn't modify their own points)
CREATE POLICY "rt_update_admin" ON reward_transactions FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- villages: missing DELETE — admin only
CREATE POLICY "villages_delete_admin" ON villages FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- weather_alerts: missing UPDATE — admin only
CREATE POLICY "wa_update_admin" ON weather_alerts FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- =====================================================
-- 3. Tighten insecure policies that use USING(true) / WITH CHECK(true)
--    on tables that should be ownership-scoped
-- =====================================================

-- buyer_offers UPDATE was using=true/check=true — restrict to buyer
DROP POLICY IF EXISTS "bof_update_all" ON buyer_offers;
CREATE POLICY "bof_update_own" ON buyer_offers FOR UPDATE
  TO authenticated USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);

-- buyer_orders UPDATE was using=true/check=true — restrict to buyer or farmer
DROP POLICY IF EXISTS "bord_update_all" ON buyer_orders;
CREATE POLICY "bord_update_own" ON buyer_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = farmer_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = farmer_id);

-- collection_centers INSERT/UPDATE were check=true — admin only
DROP POLICY IF EXISTS "cc_insert_all" ON collection_centers;
CREATE POLICY "cc_insert_admin" ON collection_centers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

DROP POLICY IF EXISTS "cc_update_all" ON collection_centers;
CREATE POLICY "cc_update_admin" ON collection_centers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- crops INSERT/UPDATE were check=true — admin only (reference data)
DROP POLICY IF EXISTS "crops_insert_all" ON crops;
CREATE POLICY "crops_insert_admin" ON crops FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

DROP POLICY IF EXISTS "crops_update_all" ON crops;
CREATE POLICY "crops_update_admin" ON crops FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- farm_clusters INSERT/UPDATE were check=true — admin or champion
DROP POLICY IF EXISTS "clusters_insert_all" ON farm_clusters;
CREATE POLICY "clusters_insert_admin_champion" ON farm_clusters FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::user_role, 'champion'::user_role)));

DROP POLICY IF EXISTS "clusters_update_all" ON farm_clusters;
CREATE POLICY "clusters_update_admin_champion" ON farm_clusters FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::user_role, 'champion'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::user_role, 'champion'::user_role)));

-- market_prices INSERT/UPDATE were check=true — admin only
DROP POLICY IF EXISTS "mp_insert_all" ON market_prices;
CREATE POLICY "mp_insert_admin" ON market_prices FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

DROP POLICY IF EXISTS "mp_update_all" ON market_prices;
CREATE POLICY "mp_update_admin" ON market_prices FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- price_predictions INSERT was check=true — admin only
DROP POLICY IF EXISTS "pp_insert_all" ON price_predictions;
CREATE POLICY "pp_insert_admin" ON price_predictions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- quality_assessments INSERT/UPDATE were check=true — admin or champion
DROP POLICY IF EXISTS "qa_insert_all" ON quality_assessments;
CREATE POLICY "qa_insert_admin_champion" ON quality_assessments FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::user_role, 'champion'::user_role)));

DROP POLICY IF EXISTS "qa_update_all" ON quality_assessments;
CREATE POLICY "qa_update_admin_champion" ON quality_assessments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::user_role, 'champion'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin'::user_role, 'champion'::user_role)));

-- villages INSERT/UPDATE were check=true — admin only
DROP POLICY IF EXISTS "villages_insert_all" ON villages;
CREATE POLICY "villages_insert_admin" ON villages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

DROP POLICY IF EXISTS "villages_update_all" ON villages;
CREATE POLICY "villages_update_admin" ON villages FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- weather_alerts INSERT was check=true — admin only
DROP POLICY IF EXISTS "wa_insert_all" ON weather_alerts;
CREATE POLICY "wa_insert_admin" ON weather_alerts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- weather_alerts DELETE was using=true — admin only
DROP POLICY IF EXISTS "wa_delete_all" ON weather_alerts;
CREATE POLICY "wa_delete_admin" ON weather_alerts FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::user_role));

-- audit_logs INSERT was check=true — keep as true (any authenticated user can log)
-- audit_logs SELECT was using=true — keep as true (all authenticated users can read logs)
-- These are acceptable for audit logs

-- chat_members SELECT was using=true — keep (members visible to all authenticated)
-- chat_groups, harvest_lots, machinery SELECT using=true — keep (shared resources visible to all)
-- buyer_offers, buyer_orders SELECT using=true — keep (marketplace visibility)
