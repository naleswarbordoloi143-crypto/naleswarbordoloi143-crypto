/*
# Fix Admin RLS Policies and Marketplace Buyer Orders

## Problem
1. AdminDashboard cannot update other users' profiles (toggleUserActive) because
   `profiles_update_own` only allows `auth.uid() = id`. An admin updating another
   user's row fails the USING clause.
2. AdminDashboard cannot see all complaints because `cp_select_own` only returns
   the admin's own complaints.
3. AdminDashboard cannot update complaint status because `cp_update_own` only
   allows updates to the user's own complaints.
4. MarketplacePage `acceptOffer` inserts a `buyer_orders` row with
   `buyer_id = offer.buyer_id` (not the farmer's id), which violates
   `bord_insert_own` (`auth.uid() = buyer_id`).

## Changes
1. **profiles**: Add admin-bypass UPDATE policy so admins can toggle is_active.
2. **complaints**: Add admin-bypass SELECT and UPDATE policies.
3. **buyer_orders**: Add a policy allowing the farmer party (farmer_id) to
   insert orders when they accept a buyer's offer.

## Security
- Admin bypass is scoped to users with `role = 'admin'` via a subquery check.
- The farmer insert policy requires `auth.uid() = farmer_id` so only the
  accepting farmer can create the order.
*/

-- 1. Admin-bypass UPDATE on profiles
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- 2. Admin-bypass SELECT on complaints
DROP POLICY IF EXISTS "cp_select_admin" ON complaints;
CREATE POLICY "cp_select_admin"
ON complaints FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- 3. Admin-bypass UPDATE on complaints
DROP POLICY IF EXISTS "cp_update_admin" ON complaints;
CREATE POLICY "cp_update_admin"
ON complaints FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- 4. Allow farmer to insert buyer_orders when accepting an offer
DROP POLICY IF EXISTS "bord_insert_farmer" ON buyer_orders;
CREATE POLICY "bord_insert_farmer"
ON buyer_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = farmer_id);
