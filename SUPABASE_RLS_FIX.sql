
-- ============================================
-- FIX FOR TIME ENTRIES RLS POLICY
-- ============================================
-- This fixes the issue where contractors cannot see their employees' time entries
-- because the policy incorrectly checks created_by instead of user_role

-- Step 1: Drop the existing broken SELECT policy
DROP POLICY IF EXISTS "Users can view their own time entries and contractors/subcontractors can view their employees' entries" ON time_entries;
DROP POLICY IF EXISTS "time_entries_select_policy" ON time_entries;
DROP POLICY IF EXISTS "Enable read access for users" ON time_entries;

-- Step 2: Create the correct SELECT policy that checks user_role
CREATE POLICY "Users can view their own time entries and contractors/subcontractors can view their employees' entries"
ON time_entries FOR SELECT
USING (
  -- Allow employees to see their own time entries
  employee = auth.uid() 
  OR 
  -- Allow contractors and subcontractors to see their employees' time entries
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND user_role IN ('contractor', 'subcontractor')
    AND EXISTS (
      SELECT 1 FROM profiles emp
      WHERE emp.id = time_entries.employee 
      AND emp.created_by = auth.uid()
    )
  )
);

-- ============================================
-- EXPLANATION:
-- ============================================
-- This policy allows:
-- 1. Employees to see their own time entries (employee = auth.uid())
-- 2. Contractors (user_role = 'contractor') to see time entries of employees they created
-- 3. Subcontractors (user_role = 'subcontractor') to see time entries of employees they created
--
-- The key fix: We check user_role IN ('contractor', 'subcontractor') instead of 
-- checking created_by IS NOT NULL, which was incorrectly identifying contractors as employees.
-- ============================================
