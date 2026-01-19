
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Linking,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface ProjectDetail {
  id: string;
  external_id?: string;
  address?: string;
  zipcode?: string;
  city?: string;
  plz?: string;
  stadt?: string;
  stockwerk?: string;
  lage?: string;
  wohnungs_id?: string;
  status?: string;
  description?: string;
  angaben?: string;
  house_superficy?: number;
  start_date?: string;
  end_date?: string;
  company_name?: string;
  progress?: number;
  leo_link?: string;
  gewerke_timeline?: GewerkeTimelineEntry[];
  net_amount?: number;
  created_at?: string;
  updated_at?: string;
  positions?: any; // JSONB column containing positions array
  [key: string]: any;
}

interface ProjectPosition {
  position_id: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  gewerke_name?: string;
  gewerke_id?: string;
  status?: string;
  nachtrag_number?: number;
  nachtrag_company?: string;
  company_name?: string | null;
  location?: string; // Execution location (e.g., "Wohnung", "Balkon", "Terrasse")
  // Legacy fields for compatibility
  id?: string;
  short_description?: string;
  long_description?: string;
  gewerke?: string;
  cancellation_note?: string;
  [key: string]: any;
}

interface PositionWithCompany extends ProjectPosition {
  resolved_company_name: string | null;
  is_subcontractor_assigned: boolean;
  assignment_type: 'trade' | 'position' | 'pdf' | 'contractor';
  locations?: string[]; // Extracted location badges
  clean_description?: string; // Description without locations
}

interface SubcontractorAssignment {
  id: string;
  project_id: string;
  subcontractor_id: string;
  assigned_trades: AssignedTrade[];
  assignment_status: 'pending' | 'accepted' | 'rejected';
}

interface AssignedTrade {
  gewerke_id: string;
  gewerke_name: string;
  positions?: { position_id: string }[];
}

interface Subcontractor {
  id: string;
  company_name: string;
}

interface GroupedPositions {
  [gewerkeName: string]: ProjectPosition[];
}

interface GewerkeTimelineEntry {
  gewerke: string;
  startDate: string;
  endDate: string;
  phase?: string;
}

interface ProjectFinances {
  totalBudget: number;
  material: { amount: number; percentage: string };
  subcontractor: { amount: number; percentage: string };
  external: { amount: number; percentage: string };
  labor: { amount: number; percentage: string };
  rest: { amount: number; percentage: string };
}

interface NachtragPosition {
  position_id: string;
  gewerke_id?: string;
  gewerke_name?: string;
  short_description: string;
  long_description?: string;
  source_lv_positionen?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  status?: string;
  order_index?: number;
}

interface Nachtrag {
  id: string;
  project_id: string;
  addendum_number: string;
  title: string;
  description?: string;
  total_value: number;
  positions: NachtragPosition[];
  subcontractor_id?: string;
  assigned_gewerke_ids?: string[];
  status: 'ausstehend' | 'angenommen' | 'abgelehnt';
  rejection_reason?: string;
  assigned_value?: number;
  is_main_order: boolean;
  notes?: string;
  accepted_at?: string;
  rejected_at?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

interface Order {
  id: string;
  order_number: string;
  project_id: string;
  products: OrderProduct[];
  total_price: number;
  status: string;
  created_at: string;
}

interface OrderProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  price_net?: number;
  price_gross?: number;
  vat_rate?: number;
}

interface BillingDraft {
  id: string;
  project_id: string;
  subcontractor_id: string;
  gewerke_ids: string[];
  gewerke_names: string[];
  total_amount: number;
  material_deduction_amount: number;
  final_amount: number;
  extra_deduction_amount?: number;
  approved_final_amount?: number;
  invoice_number?: string;
  status: 'pending' | 'approved' | 'declined' | 'invoice_pending' | 'payment_pending' | 'paid';
  subcontractor?: { company_name: string };
}

interface ExternalInvoice {
  id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  description?: string;
  invoice_date: string;
  supplier_name?: string;
  orderer_name?: string;
  file_url?: string;
  pdf_url?: string;
  employee_id?: string;
  subcontractor_id?: string;
  suborders?: any[];
  archived_at?: string;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  project_id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  status: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number;
}

// Position ID → Gewerke Mapping (as specified in context)
const positionCodeToTrade: Record<string, string> = {
  '06.01': 'Sanitär',
  '06.02': 'Reinigung',
  '06.03': 'Maler',
  '06.04': 'Fliesen',
  '06.05': 'Maurer',
  '06.06': 'Tischler',
  '06.07': 'Boden',
  '06.08': 'Elektro',
  '06.09': 'Sonstiges',
  '06.10': 'Dachdecker',
  '06.11': 'Trockenbau',
};

// CORRECT Gewerke color mapping (from src/utils/gewerkeUtils.ts)
const GEWERKE_COLORS: { [key: string]: string } = {
  'elektro': '#10b981',      // Green
  'Elektro': '#10b981',      // Green
  'sanitär': '#3b82f6',      // Blue
  'Sanitär': '#3b82f6',      // Blue
  'maler': '#ef4444',        // Red
  'Maler': '#ef4444',        // Red
  'boden': '#f97316',        // Orange
  'Boden': '#f97316',        // Orange
  'fliesen': '#06b6d4',      // Cyan/Turquoise
  'Fliesen': '#06b6d4',      // Cyan/Turquoise
  'tischler': '#a16207',     // Brown
  'Tischler': '#a16207',     // Brown
  'maurer': '#6b7280',       // Grey
  'Maurer': '#6b7280',       // Grey
  'reinigung': '#a855f7',    // Purple/Lilac
  'Reinigung': '#a855f7',    // Purple/Lilac
  'dachdecker': '#14b8a6',   // Teal
  'Dachdecker': '#14b8a6',   // Teal
  'trockenbau': '#6366f1',   // Indigo
  'Trockenbau': '#6366f1',   // Indigo
  'heizung': '#ea580c',      // Deep Orange
  'Heizung': '#ea580c',      // Deep Orange
  'zimmermann': '#d97706',   // Amber
  'Zimmermann': '#d97706',   // Amber
  'sonstiges': '#4b5563',    // Dark Grey
  'Sonstiges': '#4b5563',    // Dark Grey
  'asbest': '#000000',       // Black
  'Asbest': '#000000',       // Black
};

// Subcontractor-specific colors - each subcontractor gets a unique color
const SUBCONTRACTOR_COLORS = [
  '#F59E0B', // Amber/Orange
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EAB308', // Yellow
  '#A855F7', // Violet
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F43F5E', // Rose
];

// Finance category colors
const FINANCE_COLORS = {
  material: '#3B82F6',       // Blue
  subcontractor: '#F59E0B',  // Orange
  external: '#EC4899',       // Pink
  labor: '#22C55E',          // Green
  rest: '#78716C',           // Gray
};

// Nachtrag status colors
const NACHTRAG_STATUS_COLORS = {
  ausstehend: '#F59E0B',     // Orange
  angenommen: '#22C55E',     // Green
  abgelehnt: '#EF4444',      // Red
};

// Helper function to determine Gewerke from position_id prefix
function getTradeFromPositionId(positionId: string): string {
  if (!positionId) return 'Sonstiges';
  const prefix = positionId.substring(0, 5); // Extract "06.08" from "06.08.01.0140"
  return positionCodeToTrade[prefix] || 'Sonstiges';
}

// Helper function to group positions by Gewerke
function groupPositionsByGewerke(positions: PositionWithCompany[]): Record<string, PositionWithCompany[]> {
  return positions.reduce((groups, position) => {
    const gewerke = getTradeFromPositionId(position.position_id);
    if (!groups[gewerke]) {
      groups[gewerke] = [];
    }
    groups[gewerke].push(position);
    return groups;
  }, {} as Record<string, PositionWithCompany[]>);
}

// Helper function to extract locations from description
// Pattern: Description ends with "(Gewerkecluster ...)" and then locations follow
function extractLocationsFromDescription(description: string): { cleanDescription: string; locations: string[] } {
  console.log('Extracting locations from:', description);
  
  // Common location keywords
  const locationKeywords = [
    'Wohnung', 'Bad', 'Kinderzimmer', 'Schlafzimmer', 'Wohnzimmer', 
    'Küche', 'Balkon', 'Terrasse', 'Flur', 'Diele', 'WC', 'Gäste-WC',
    'Arbeitszimmer', 'Esszimmer', 'Keller', 'Dachboden', 'Garage',
    'Abstellraum', 'Hauswirtschaftsraum', 'Gästezimmer'
  ];
  
  // Find the Gewerkecluster pattern
  const gewerkeClusterMatch = description.match(/\(Gewerkecluster[^)]*\)/i);
  
  if (!gewerkeClusterMatch) {
    console.log('No Gewerkecluster pattern found');
    return { cleanDescription: description, locations: [] };
  }
  
  const gewerkeClusterIndex = gewerkeClusterMatch.index!;
  const gewerkeClusterEnd = gewerkeClusterIndex + gewerkeClusterMatch[0].length;
  
  // Everything before Gewerkecluster is the clean description
  const cleanDescription = description.substring(0, gewerkeClusterIndex + gewerkeClusterMatch[0].length).trim();
  
  // Everything after Gewerkecluster might contain locations
  const afterGewerkecluster = description.substring(gewerkeClusterEnd).trim();
  
  console.log('Clean description:', cleanDescription);
  console.log('After Gewerkecluster:', afterGewerkecluster);
  
  // Extract locations from the text after Gewerkecluster
  const locations: string[] = [];
  
  // Split by common separators (comma, semicolon, "und", etc.)
  const parts = afterGewerkecluster.split(/[,;]|\sund\s/i);
  
  for (const part of parts) {
    const trimmedPart = part.trim();
    // Check if this part contains any location keyword
    for (const keyword of locationKeywords) {
      if (trimmedPart.toLowerCase().includes(keyword.toLowerCase())) {
        // Extract just the location name (remove extra text)
        const locationMatch = trimmedPart.match(new RegExp(keyword, 'i'));
        if (locationMatch) {
          locations.push(keyword);
          break; // Only add once per part
        }
      }
    }
  }
  
  // Remove duplicates
  const uniqueLocations = Array.from(new Set(locations));
  
  console.log('Extracted locations:', uniqueLocations);
  
  return {
    cleanDescription,
    locations: uniqueLocations
  };
}

// Helper function to get a consistent color for a subcontractor
function getSubcontractorColor(subcontractorName: string, subcontractorColorMap: Map<string, string>): string {
  if (subcontractorColorMap.has(subcontractorName)) {
    return subcontractorColorMap.get(subcontractorName)!;
  }
  
  // Assign a new color based on the current map size
  const colorIndex = subcontractorColorMap.size % SUBCONTRACTOR_COLORS.length;
  const color = SUBCONTRACTOR_COLORS[colorIndex];
  subcontractorColorMap.set(subcontractorName, color);
  
  console.log(`Assigned color ${color} to subcontractor ${subcontractorName}`);
  
  return color;
}

// Helper function to determine company name based on priority logic
function getCompanyForPosition(
  position: ProjectPosition,
  assignments: SubcontractorAssignment[],
  subcontractorMap: Map<string, string>,
  contractorCompanyName: string
): {
  company_name: string | null;
  is_subcontractor: boolean;
  assignment_type: 'trade' | 'position' | 'pdf' | 'contractor';
} {
  const positionId = position.position_id;
  const positionTrade = getTradeFromPositionId(positionId);

  console.log(`\n=== Resolving company for position ${positionId} ===`);
  console.log('Position trade (from ID):', positionTrade);
  console.log('Position data:', {
    position_id: position.position_id,
    company_name: position.company_name,
    nachtrag_company: position.nachtrag_company,
    description: position.description?.substring(0, 50),
  });
  console.log('Available assignments:', assignments.length);
  console.log('Subcontractor map size:', subcontractorMap.size);

  // PRIORITY 1: Check subcontractor_project_assignments.assigned_trades JSONB column
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const assignedTrades = Array.isArray(assignment.assigned_trades)
      ? assignment.assigned_trades
      : [];

    console.log(`\nChecking assignment ${i + 1}/${assignments.length}:`);
    console.log('  Subcontractor ID:', assignment.subcontractor_id);
    console.log('  Assignment status:', assignment.assignment_status);
    console.log('  Assigned trades count:', assignedTrades.length);
    console.log('  Assigned trades:', JSON.stringify(assignedTrades, null, 2));

    for (let j = 0; j < assignedTrades.length; j++) {
      const trade = assignedTrades[j];
      console.log(`\n  Checking trade ${j + 1}/${assignedTrades.length}:`);
      console.log('    Trade gewerke_name:', trade.gewerke_name);
      console.log('    Trade gewerke_id:', trade.gewerke_id);
      console.log('    Trade positions:', trade.positions);

      // Check specific position assignment (position-level assignment)
      if (trade.positions && Array.isArray(trade.positions) && trade.positions.length > 0) {
        console.log('    → Position-level assignment detected (positions array has items)');
        console.log('    → Checking if position', positionId, 'is in positions array');
        
        const hasPosition = trade.positions.some((p: any) => {
          console.log('      Comparing:', p.position_id, '===', positionId, '?', p.position_id === positionId);
          return p.position_id === positionId;
        });
        
        if (hasPosition) {
          const companyName = subcontractorMap.get(assignment.subcontractor_id);
          console.log('    ✅ MATCH! Position found in assignment. Company:', companyName);
          if (companyName) {
            return {
              company_name: companyName,
              is_subcontractor: true,
              assignment_type: 'position',
            };
          }
        } else {
          console.log('    ❌ Position not found in this trade\'s positions array');
        }
      } else {
        // Whole trade assigned (trade-level assignment - positions array empty or undefined)
        console.log('    → Trade-level assignment detected (positions array empty/undefined)');
        console.log('    → Comparing trade gewerke_name:', trade.gewerke_name, 'with position trade:', positionTrade);
        
        if (trade.gewerke_name === positionTrade) {
          const companyName = subcontractorMap.get(assignment.subcontractor_id);
          console.log('    ✅ MATCH! Trade matches. Company:', companyName);
          if (companyName) {
            return {
              company_name: companyName,
              is_subcontractor: true,
              assignment_type: 'trade',
            };
          }
        } else {
          console.log('    ❌ Trade does not match');
        }
      }
    }
  }

  // PRIORITY 2: Fallback to projects.positions JSONB column (company_name field in position)
  const positionCompanyName = position.company_name || position.nachtrag_company;
  if (positionCompanyName) {
    console.log('\n→ PRIORITY 2: Found company in position data:', positionCompanyName);
    // Check if this company is a known subcontractor
    const isSubcontractor = Array.from(subcontractorMap.values()).includes(positionCompanyName);
    console.log('  Is known subcontractor?', isSubcontractor);
    return {
      company_name: positionCompanyName,
      is_subcontractor: isSubcontractor,
      assignment_type: 'pdf',
    };
  }

  // PRIORITY 3: Fallback to contractor (project.company_name)
  console.log('\n→ PRIORITY 3: Falling back to contractor:', contractorCompanyName);
  return {
    company_name: contractorCompanyName,
    is_subcontractor: false,
    assignment_type: 'contractor',
  };
}

// Helper function to calculate subtotal for a Gewerke group
function calculateGewerkeSubtotal(positions: PositionWithCompany[]): number {
  return positions.reduce((sum, position) => {
    return sum + (position.total_price || 0);
  }, 0);
}

// Fetch langtext for positions from trade_positions table
async function fetchLangtextForPositions(positionIds: string[]): Promise<Record<string, string>> {
  console.log('ProjectDetailScreen: Fetching langtext for position IDs:', positionIds);
  
  if (positionIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('trade_positions')
    .select('lv_positionen, long_description')
    .in('lv_positionen', positionIds);

  if (error) {
    console.error('ProjectDetailScreen: Error fetching langtext', error);
    return {};
  }

  const langtextMap: Record<string, string> = {};
  data?.forEach((tp) => {
    if (tp.long_description) {
      langtextMap[tp.lv_positionen] = tp.long_description;
    }
  });

  console.log('ProjectDetailScreen: Fetched langtext for', Object.keys(langtextMap).length, 'positions');
  return langtextMap;
}

// Helper functions for finance calculations
const getPercentage = (value: number, total: number): string => {
  return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
};

const computeOrderNet = (products: any[]): number => {
  return products.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
};

const calculateLaborCost = (timeEntries: any[]): number => {
  // TODO: Implement hourly rate calculation based on employee data
  // For now, using a placeholder calculation
  return timeEntries.reduce((sum, entry) => {
    const duration = entry.duration || 0; // in minutes
    const hourlyRate = 50; // Default hourly rate in EUR
    return sum + (duration / 60) * hourlyRate;
  }, 0);
};

export default function ProjectDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const isDark = theme.dark;
  const themeColors = isDark ? colors.dark : colors.light;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [positions, setPositions] = useState<PositionWithCompany[]>([]);
  const [groupedPositions, setGroupedPositions] = useState<Record<string, PositionWithCompany[]>>({});
  const [langtextMap, setLangtextMap] = useState<Record<string, string>>({});
  const [contractorCompanyName, setContractorCompanyName] = useState<string>('Haupt Bau GmbH'); // Default contractor name
  const [finances, setFinances] = useState<ProjectFinances | null>(null);
  const [nachtraege, setNachtraege] = useState<Nachtrag[]>([]);
  const [subcontractorColorMap, setSubcontractorColorMap] = useState<Map<string, string>>(new Map());
  
  // Modal state for displaying langtext
  const [selectedPosition, setSelectedPosition] = useState<PositionWithCompany | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Modal state for displaying Nachtrag details
  const [selectedNachtrag, setSelectedNachtrag] = useState<Nachtrag | null>(null);
  const [nachtragModalVisible, setNachtragModalVisible] = useState(false);

  // Finance category modal states
  const [financeModalVisible, setFinanceModalVisible] = useState(false);
  const [financeModalType, setFinanceModalType] = useState<'material' | 'subcontractor' | 'external' | 'labor' | 'rest' | null>(null);
  const [financeModalData, setFinanceModalData] = useState<any>(null);

  const fetchProjectFinances = useCallback(async (projectId: string, externalId: string) => {
    console.log('ProjectDetailScreen: Fetching project finances for project:', projectId);
    
    try {
      // 1. Get project total budget
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('net_amount')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('ProjectDetailScreen: Error fetching project budget', projectError);
        return null;
      }

      // 2. Get addendums (Nachträge) total value
      const { data: addendums, error: addendumsError } = await supabase
        .from('project_addendums')
        .select('total_value, status')
        .eq('project_id', projectId)
        .eq('is_main_order', false); // Only get addendums, not main order

      if (addendumsError) {
        console.error('ProjectDetailScreen: Error fetching addendums', addendumsError);
      }

      // Calculate addendums total (only accepted addendums)
      const addendumsTotal = addendums
        ?.filter(a => a.status === 'angenommen')
        .reduce((sum, a) => sum + (a.total_value || 0), 0) || 0;

      console.log('ProjectDetailScreen: Addendums total:', addendumsTotal);

      // 3. Get material costs from orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('products, total_amount, status')
        .eq('project_external_id', externalId)
        .neq('status', 'cancelled');

      if (ordersError) {
        console.error('ProjectDetailScreen: Error fetching orders', ordersError);
      }

      // 4. Get subcontractor invoices from billing_drafts
      const { data: billingDrafts, error: billingError } = await supabase
        .from('billing_drafts')
        .select('approved_final_amount, final_amount, status, extra_deduction_amount')
        .eq('project_id', projectId);

      if (billingError) {
        console.error('ProjectDetailScreen: Error fetching billing drafts', billingError);
      }

      // 5. Get time entries for labor costs
      const { data: timeEntries, error: timeError } = await supabase
        .from('time_entries')
        .select('duration, employee')
        .eq('project_id', projectId);

      if (timeError) {
        console.error('ProjectDetailScreen: Error fetching time entries', timeError);
      }

      // Calculate totals - INCLUDE ADDENDUMS IN TOTAL BUDGET
      const baseBudget = projectData?.net_amount || 0;
      const totalBudget = baseBudget + addendumsTotal;

      console.log('ProjectDetailScreen: Base budget:', baseBudget, 'Addendums:', addendumsTotal, 'Total budget:', totalBudget);

      const materialCost = orders?.reduce((sum, order) => {
        return sum + computeOrderNet(order.products || []);
      }, 0) || 0;

      const subcontractorTotal = billingDrafts
        ?.filter(d => ['approved', 'paid', 'invoice_assigned'].includes(d.status))
        .reduce((sum, d) => sum + (d.approved_final_amount || d.final_amount || 0), 0) || 0;

      const externalInvoices = billingDrafts
        ?.reduce((sum, d) => sum + (d.extra_deduction_amount || 0), 0) || 0;

      const laborCost = calculateLaborCost(timeEntries || []);

      const rest = totalBudget - materialCost - subcontractorTotal - externalInvoices - laborCost;

      const financesData: ProjectFinances = {
        totalBudget,
        material: { amount: materialCost, percentage: getPercentage(materialCost, totalBudget) },
        subcontractor: { amount: subcontractorTotal, percentage: getPercentage(subcontractorTotal, totalBudget) },
        external: { amount: externalInvoices, percentage: getPercentage(externalInvoices, totalBudget) },
        labor: { amount: laborCost, percentage: getPercentage(laborCost, totalBudget) },
        rest: { amount: rest, percentage: getPercentage(rest, totalBudget) },
      };

      console.log('ProjectDetailScreen: Calculated finances:', financesData);
      return financesData;
    } catch (error) {
      console.error('ProjectDetailScreen: Error calculating finances', error);
      return null;
    }
  }, []);

  const fetchNachtraege = useCallback(async (projectId: string) => {
    console.log('ProjectDetailScreen: Fetching Nachträge for project:', projectId);
    
    try {
      const { data, error } = await supabase
        .from('project_addendums')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_main_order', false) // Exclude main order
        .order('created_at', { ascending: true });

      if (error) {
        console.error('ProjectDetailScreen: Error fetching Nachträge', error);
        return [];
      }

      console.log('ProjectDetailScreen: Fetched Nachträge:', data);
      return data || [];
    } catch (error) {
      console.error('ProjectDetailScreen: Error fetching Nachträge', error);
      return [];
    }
  }, []);

  const fetchProjectDetails = useCallback(async () => {
    console.log('ProjectDetailScreen: Fetching project details for ID:', id);
    try {
      setLoading(true);

      // Fetch project details including the positions JSONB column and gewerke_timeline
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) {
        console.error('ProjectDetailScreen: Error fetching project', projectError);
        setProject(null);
        setPositions([]);
        setGroupedPositions({});
        setLangtextMap({});
        setFinances(null);
        setNachtraege([]);
      } else {
        console.log('ProjectDetailScreen: Project loaded', projectData);
        console.log('ProjectDetailScreen: Gewerke Timeline:', projectData?.gewerke_timeline);
        console.log('ProjectDetailScreen: Project company_name:', projectData?.company_name);
        setProject(projectData);

        // Set contractor company name from project data
        const contractorName = projectData?.company_name || 'Haupt Bau GmbH';
        setContractorCompanyName(contractorName);
        console.log('ProjectDetailScreen: Contractor company name set to:', contractorName);

        // Fetch Nachträge FIRST (before calculating finances)
        const nachtraegeData = await fetchNachtraege(id as string);
        setNachtraege(nachtraegeData);
        console.log('ProjectDetailScreen: Fetched Nachträge count:', nachtraegeData.length);

        // Fetch project finances (this now includes nachträge in the calculation)
        if (projectData?.external_id) {
          const financesData = await fetchProjectFinances(id as string, projectData.external_id);
          setFinances(financesData);
        }

        // Extract positions from the JSONB column
        let positionsArray: ProjectPosition[] = [];
        
        if (projectData?.positions) {
          console.log('ProjectDetailScreen: Raw positions data type:', typeof projectData.positions);
          console.log('ProjectDetailScreen: Raw positions data (first 2):', JSON.stringify(projectData.positions).substring(0, 500));
          
          // Handle different possible formats of the positions JSONB data
          if (Array.isArray(projectData.positions)) {
            positionsArray = projectData.positions;
          } else if (typeof projectData.positions === 'object') {
            // If positions is an object, convert to array
            positionsArray = Object.values(projectData.positions);
          }
          
          console.log('ProjectDetailScreen: Parsed positions array count:', positionsArray.length);
          console.log('ProjectDetailScreen: First position sample:', positionsArray[0]);
        } else {
          console.log('ProjectDetailScreen: No positions found in project data');
        }

        // Fetch subcontractor assignments for this project - REMOVED STATUS FILTER
        console.log('ProjectDetailScreen: Fetching ALL subcontractor assignments for project:', id);
        const { data: assignments, error: assignmentsError } = await supabase
          .from('subcontractor_project_assignments')
          .select('subcontractor_id, assigned_trades, assignment_status')
          .eq('project_id', id);
          // REMOVED: .eq('assignment_status', 'accepted')

        if (assignmentsError) {
          console.error('ProjectDetailScreen: Error fetching assignments', assignmentsError);
          console.error('ProjectDetailScreen: Assignment error details:', JSON.stringify(assignmentsError, null, 2));
        } else {
          console.log('ProjectDetailScreen: ✅ Fetched assignments count:', assignments?.length || 0);
          if (assignments && assignments.length > 0) {
            console.log('ProjectDetailScreen: ✅ Assignments detail:', JSON.stringify(assignments, null, 2));
          } else {
            console.log('ProjectDetailScreen: ⚠️ No assignments found in database for this project');
            console.log('ProjectDetailScreen: ⚠️ This means either:');
            console.log('  1. No subcontractors have been assigned to this project yet');
            console.log('  2. The project_id in the query does not match any records');
            console.log('  3. The subcontractor_project_assignments table is empty');
          }
        }

        // Fetch subcontractor company names
        const subcontractorIds = (assignments || []).map(a => a.subcontractor_id);
        let subcontractors: Subcontractor[] = [];
        
        if (subcontractorIds.length > 0) {
          console.log('ProjectDetailScreen: Fetching subcontractors for IDs:', subcontractorIds);
          const { data: subcontractorsData, error: subcontractorsError } = await supabase
            .from('subcontractors')
            .select('id, company_name')
            .in('id', subcontractorIds);

          if (subcontractorsError) {
            console.error('ProjectDetailScreen: Error fetching subcontractors', subcontractorsError);
          } else {
            subcontractors = subcontractorsData || [];
            console.log('ProjectDetailScreen: ✅ Fetched subcontractors:', subcontractors);
          }
        } else {
          console.log('ProjectDetailScreen: ⚠️ No subcontractor IDs to fetch (assignments array is empty)');
        }

        // Build subcontractor map
        const subcontractorMap = new Map<string, string>(
          subcontractors.map(s => [s.id, s.company_name])
        );
        console.log('ProjectDetailScreen: Subcontractor map size:', subcontractorMap.size);
        if (subcontractorMap.size > 0) {
          console.log('ProjectDetailScreen: ✅ Subcontractor map entries:', Array.from(subcontractorMap.entries()));
        } else {
          console.log('ProjectDetailScreen: ⚠️ Subcontractor map is EMPTY - no company names will be resolved from assignments');
        }

        // Initialize subcontractor color map
        const colorMap = new Map<string, string>();

        // Resolve company names for all positions using priority logic
        const positionsWithCompany: PositionWithCompany[] = positionsArray.map((position, index) => {
          console.log(`ProjectDetailScreen: Processing position ${index + 1}/${positionsArray.length}:`, position.position_id);
          const companyInfo = getCompanyForPosition(
            position,
            assignments || [],
            subcontractorMap,
            contractorName
          );

          console.log(`ProjectDetailScreen: Position ${position.position_id} resolved to:`, {
            company_name: companyInfo.company_name,
            is_subcontractor: companyInfo.is_subcontractor,
            assignment_type: companyInfo.assignment_type,
          });

          // Extract locations from description
          const description = position.description || position.short_description || '';
          const { cleanDescription, locations } = extractLocationsFromDescription(description);

          // Assign color to subcontractor if it's a subcontractor
          if (companyInfo.is_subcontractor && companyInfo.company_name) {
            getSubcontractorColor(companyInfo.company_name, colorMap);
          }

          return {
            ...position,
            resolved_company_name: companyInfo.company_name,
            is_subcontractor_assigned: companyInfo.is_subcontractor,
            assignment_type: companyInfo.assignment_type,
            clean_description: cleanDescription,
            locations: locations,
          };
        });

        console.log('ProjectDetailScreen: Positions with resolved company names (summary):');
        positionsWithCompany.forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.position_id} -> ${p.resolved_company_name} (${p.assignment_type}), locations: ${p.locations?.join(', ')}`);
        });
        
        setPositions(positionsWithCompany);
        setSubcontractorColorMap(colorMap);
        console.log('ProjectDetailScreen: Subcontractor color map:', Array.from(colorMap.entries()));

        // Group positions by Gewerke using position_id prefix mapping
        const grouped = groupPositionsByGewerke(positionsWithCompany);

        console.log('ProjectDetailScreen: Grouped positions:', Object.keys(grouped));
        console.log('ProjectDetailScreen: Total positions count:', positionsWithCompany.length);
        setGroupedPositions(grouped);

        // Fetch langtext for all positions
        const positionIds = positionsWithCompany.map(p => p.position_id).filter(Boolean);
        if (positionIds.length > 0) {
          const langtext = await fetchLangtextForPositions(positionIds);
          setLangtextMap(langtext);
        }
      }
    } catch (error) {
      console.error('ProjectDetailScreen: Error fetching data', error);
      setProject(null);
      setPositions([]);
      setGroupedPositions({});
      setLangtextMap({});
      setFinances(null);
      setNachtraege([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, contractorCompanyName, fetchProjectFinances, fetchNachtraege]);

  useEffect(() => {
    if (id) {
      fetchProjectDetails();
    }
  }, [fetchProjectDetails]);

  const onRefresh = () => {
    console.log('ProjectDetailScreen: User pulled to refresh');
    setRefreshing(true);
    fetchProjectDetails();
  };

  const openLangtextModal = (position: PositionWithCompany) => {
    console.log('ProjectDetailScreen: User tapped View Details for position', position.position_id);
    setSelectedPosition(position);
    setModalVisible(true);
  };

  const closeLangtextModal = () => {
    console.log('ProjectDetailScreen: User closed langtext modal');
    setModalVisible(false);
    setSelectedPosition(null);
  };

  const openNachtragModal = (nachtrag: Nachtrag) => {
    console.log('ProjectDetailScreen: User tapped Nachtrag', nachtrag.addendum_number);
    setSelectedNachtrag(nachtrag);
    setNachtragModalVisible(true);
  };

  const closeNachtragModal = () => {
    console.log('ProjectDetailScreen: User closed Nachtrag modal');
    setNachtragModalVisible(false);
    setSelectedNachtrag(null);
  };

  const openFinanceModal = async (type: 'material' | 'subcontractor' | 'external' | 'labor' | 'rest') => {
    console.log('ProjectDetailScreen: User tapped finance category:', type);
    setFinanceModalType(type);
    
    // Fetch detailed data based on type
    try {
      if (type === 'material') {
        // Fetch orders with products
        const { data: orders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('project_external_id', project?.external_id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching orders:', error);
        } else {
          setFinanceModalData(orders || []);
        }
      } else if (type === 'subcontractor') {
        // Fetch billing drafts with subcontractor info
        const { data: billingDrafts, error } = await supabase
          .from('billing_drafts')
          .select('*, subcontractor:subcontractors(company_name)')
          .eq('project_id', id)
          .not('invoice_number', 'is', null)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching billing drafts:', error);
        } else {
          setFinanceModalData(billingDrafts || []);
        }
      } else if (type === 'external') {
        // Fetch external invoices
        const { data: externalInvoices, error } = await supabase
          .from('external_invoices')
          .select('*')
          .eq('project_id', id)
          .is('archived_at', null)
          .order('invoice_date', { ascending: false });
        
        if (error) {
          console.error('Error fetching external invoices:', error);
        } else {
          setFinanceModalData(externalInvoices || []);
        }
      } else if (type === 'labor') {
        // Fetch time entries with employee info
        const { data: timeEntries, error } = await supabase
          .from('time_entries')
          .select('*, employee:employees(first_name, last_name, hourly_rate)')
          .eq('project_id', id)
          .order('date', { ascending: false });
        
        if (error) {
          console.error('Error fetching time entries:', error);
        } else {
          setFinanceModalData(timeEntries || []);
        }
      } else if (type === 'rest') {
        // For rest, show calculation breakdown
        setFinanceModalData({
          totalBudget: finances?.totalBudget || 0,
          material: finances?.material.amount || 0,
          subcontractor: finances?.subcontractor.amount || 0,
          external: finances?.external.amount || 0,
          labor: finances?.labor.amount || 0,
          rest: finances?.rest.amount || 0,
        });
      }
      
      setFinanceModalVisible(true);
    } catch (error) {
      console.error('Error opening finance modal:', error);
    }
  };

  const closeFinanceModal = () => {
    console.log('ProjectDetailScreen: User closed finance modal');
    setFinanceModalVisible(false);
    setFinanceModalType(null);
    setFinanceModalData(null);
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
      case 'aktiv':
        return themeColors.primary;
      case 'completed':
      case 'abgeschlossen':
        return themeColors.success;
      case 'on_hold':
      case 'pausiert':
        return themeColors.warning;
      default:
        return themeColors.textSecondary;
    }
  };

  const getStatusGradient = (status?: string): [string, string] => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
      case 'aktiv':
        return [themeColors.primary, themeColors.primaryDark];
      case 'completed':
      case 'abgeschlossen':
        return [themeColors.success, themeColors.successDark];
      case 'on_hold':
      case 'pausiert':
        return [themeColors.warning, themeColors.warningDark];
      default:
        return [themeColors.textSecondary, themeColors.textSecondary];
    }
  };

  const getPositionStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'angenommen':
        return themeColors.success;
      case 'in_progress':
      case 'abgerechnet':
        return themeColors.primary;
      case 'cancelled':
        return themeColors.error;
      case 'pending':
      case 'ausstehend':
      default:
        return themeColors.warning;
    }
  };

  const getNachtragStatusColor = (status: string) => {
    return NACHTRAG_STATUS_COLORS[status as keyof typeof NACHTRAG_STATUS_COLORS] || themeColors.textSecondary;
  };

  const getGewerkeColor = (gewerkeName: string): string => {
    // Try exact match first (case-insensitive)
    const lowerName = gewerkeName.toLowerCase();
    return GEWERKE_COLORS[lowerName] || GEWERKE_COLORS[gewerkeName] || '#4b5563'; // Default to dark grey
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // ✅ FIX: Calculate total positions INCLUDING nachtrag positions
  const calculateTotalPositions = () => {
    const mainPositionsCount = positions.length;
    const nachtragPositionsCount = nachtraege.reduce((sum, nachtrag) => {
      // Only count positions from accepted nachträge
      if (nachtrag.status === 'angenommen') {
        return sum + (nachtrag.positions?.length || 0);
      }
      return sum;
    }, 0);
    
    const total = mainPositionsCount + nachtragPositionsCount;
    console.log('ProjectDetailScreen: Total positions calculation:', {
      mainPositions: mainPositionsCount,
      nachtragPositions: nachtragPositionsCount,
      total: total
    });
    
    return total;
  };

  // ✅ FIX: Calculate total price INCLUDING nachtrag positions
  const calculateTotalPrice = () => {
    const mainPositionsTotal = positions.reduce((sum, pos) => sum + (pos.total_price || 0), 0);
    const nachtragPositionsTotal = nachtraege.reduce((sum, nachtrag) => {
      // Only count value from accepted nachträge
      if (nachtrag.status === 'angenommen') {
        return sum + (nachtrag.total_value || 0);
      }
      return sum;
    }, 0);
    
    const total = mainPositionsTotal + nachtragPositionsTotal;
    console.log('ProjectDetailScreen: Total price calculation:', {
      mainPositionsTotal: mainPositionsTotal,
      nachtragPositionsTotal: nachtragPositionsTotal,
      total: total
    });
    
    return total;
  };
  
  const getFullAddress = (project: ProjectDetail | null) => {
    if (!project) return '';
    
    const parts = [
      project.address,
      project.zipcode || project.plz,
      project.city || project.stadt,
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  const openLeoLink = async () => {
    if (project?.leo_link) {
      console.log('ProjectDetailScreen: User tapped Leo link', project.leo_link);
      try {
        const canOpen = await Linking.canOpenURL(project.leo_link);
        if (canOpen) {
          await Linking.openURL(project.leo_link);
        } else {
          console.error('ProjectDetailScreen: Cannot open Leo link', project.leo_link);
        }
      } catch (error) {
        console.error('ProjectDetailScreen: Error opening Leo link', error);
      }
    }
  };

  const getFinanceModalTitle = () => {
    switch (financeModalType) {
      case 'material':
        return 'Material Details';
      case 'subcontractor':
        return 'Subunternehmer Rechnungen';
      case 'external':
        return 'Externe Rechnungen';
      case 'labor':
        return 'Labor (Lohnkosten)';
      case 'rest':
        return 'Rest - Calculation Breakdown';
      default:
        return 'Finance Details';
    }
  };

  const getFinanceModalColor = () => {
    switch (financeModalType) {
      case 'material':
        return FINANCE_COLORS.material;
      case 'subcontractor':
        return FINANCE_COLORS.subcontractor;
      case 'external':
        return FINANCE_COLORS.external;
      case 'labor':
        return FINANCE_COLORS.labor;
      case 'rest':
        return FINANCE_COLORS.rest;
      default:
        return themeColors.primary;
    }
  };

  if (loading && !project) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Project Details',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: themeColors.background },
            headerTintColor: themeColors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading project details...
          </Text>
        </View>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Project Details',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: themeColors.background },
            headerTintColor: themeColors.text,
          }}
        />
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={themeColors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>
            Project not found
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: themeColors.primary }]}
            onPress={() => {
              console.log('ProjectDetailScreen: User tapped back to projects');
              router.back();
            }}
          >
            <Text style={styles.backButtonText}>Back to Projects</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const fullAddress = getFullAddress(project);
  const gewerkeTimeline = project.gewerke_timeline || [];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: project.external_id || 'Project Details',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Comprehensive Project Info Header */}
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={[styles.projectInfoCard, { backgroundColor: themeColors.card }, shadows.large]}>
            {/* External ID (LWS-79818) */}
            <View style={styles.projectInfoHeader}>
              <Text style={[styles.projectExternalId, { color: themeColors.text }]}>
                {project.external_id || 'N/A'}
              </Text>
              {project.company_name && (
                <View style={styles.companyBadge}>
                  <Text style={styles.companyBadgeText}>
                    {project.company_name}
                  </Text>
                </View>
              )}
            </View>

            {/* Wohnungs-ID */}
            {project.wohnungs_id && (
              <View style={styles.projectInfoRow}>
                <View style={[styles.projectInfoIcon, { backgroundColor: themeColors.primary + '20' }]}>
                  <IconSymbol
                    ios_icon_name="house.fill"
                    android_material_icon_name="home"
                    size={18}
                    color={themeColors.primary}
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    Wohnungs-ID
                  </Text>
                  <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                    {project.wohnungs_id}
                  </Text>
                </View>
              </View>
            )}

            {/* Adresse */}
            {fullAddress && (
              <View style={styles.projectInfoRow}>
                <View style={[styles.projectInfoIcon, { backgroundColor: '#EF4444' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={18}
                    color="#EF4444"
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    Adresse
                  </Text>
                  <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                    {fullAddress}
                  </Text>
                </View>
              </View>
            )}

            {/* Lage (1. Obergeschoss links) */}
            {(project.lage || project.stockwerk) && (
              <View style={styles.projectInfoRow}>
                <View style={[styles.projectInfoIcon, { backgroundColor: '#A855F7' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="building.2"
                    android_material_icon_name="business"
                    size={18}
                    color="#A855F7"
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    Lage
                  </Text>
                  <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                    {project.lage || project.stockwerk}
                  </Text>
                </View>
              </View>
            )}

            {/* Startdatum & Enddatum */}
            <View style={styles.projectInfoRowDouble}>
              {project.start_date && (
                <View style={styles.projectInfoRowHalf}>
                  <View style={[styles.projectInfoIcon, { backgroundColor: '#10B981' + '20' }]}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar-today"
                      size={18}
                      color="#10B981"
                    />
                  </View>
                  <View style={styles.projectInfoContent}>
                    <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                      Startdatum
                    </Text>
                    <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                      {formatDate(project.start_date)}
                    </Text>
                  </View>
                </View>
              )}
              {project.end_date && (
                <View style={styles.projectInfoRowHalf}>
                  <View style={[styles.projectInfoIcon, { backgroundColor: '#F97316' + '20' }]}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="event"
                      size={18}
                      color="#F97316"
                    />
                  </View>
                  <View style={styles.projectInfoContent}>
                    <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                      Enddatum
                    </Text>
                    <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                      {formatDate(project.end_date)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* LEO Portal Link */}
            {project.leo_link && (
              <TouchableOpacity
                style={styles.projectInfoRow}
                onPress={openLeoLink}
                activeOpacity={0.7}
              >
                <View style={[styles.projectInfoIcon, { backgroundColor: '#3B82F6' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="link"
                    android_material_icon_name="link"
                    size={18}
                    color="#3B82F6"
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    LEO Portal
                  </Text>
                  <Text style={[styles.projectInfoValueLink, { color: '#3B82F6' }]}>
                    Link öffnen
                  </Text>
                </View>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={18}
                  color={themeColors.textSecondary}
                />
              </TouchableOpacity>
            )}

            {/* Angaben (58,63 m², Bad (3,00 m²)...) */}
            {project.angaben && (
              <View style={styles.projectInfoRow}>
                <View style={[styles.projectInfoIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="doc.text"
                    android_material_icon_name="description"
                    size={18}
                    color="#F59E0B"
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    Angaben
                  </Text>
                  <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                    {project.angaben}
                  </Text>
                </View>
              </View>
            )}

            {/* Hinweise (description) */}
            {project.description && (
              <View style={styles.projectInfoRow}>
                <View style={[styles.projectInfoIcon, { backgroundColor: '#EC4899' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="info.circle"
                    android_material_icon_name="info"
                    size={18}
                    color="#EC4899"
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    Hinweise
                  </Text>
                  <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                    {project.description}
                  </Text>
                </View>
              </View>
            )}

            {/* Wohnfläche (house_superficy) */}
            {project.house_superficy && (
              <View style={styles.projectInfoRow}>
                <View style={[styles.projectInfoIcon, { backgroundColor: '#14B8A6' + '20' }]}>
                  <IconSymbol
                    ios_icon_name="square.grid.2x2"
                    android_material_icon_name="grid-on"
                    size={18}
                    color="#14B8A6"
                  />
                </View>
                <View style={styles.projectInfoContent}>
                  <Text style={[styles.projectInfoLabel, { color: themeColors.textSecondary }]}>
                    Wohnfläche
                  </Text>
                  <Text style={[styles.projectInfoValue, { color: themeColors.text }]}>
                    {project.house_superficy} m²
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Finanzen Card - NOW CLICKABLE */}
        {finances && (
          <Animated.View entering={FadeInDown.delay(100).duration(600)}>
            <View style={[styles.financeCard, { backgroundColor: themeColors.card }, shadows.large]}>
              <View style={styles.financeHeader}>
                <IconSymbol
                  ios_icon_name="eurosign.circle"
                  android_material_icon_name="euro"
                  size={24}
                  color={themeColors.primary}
                />
                <Text style={[styles.financeTitle, { color: themeColors.text }]}>
                  Finanzen
                </Text>
              </View>

              {/* Total Budget */}
              <View style={[styles.financeTotalRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.financeTotalLabel, { color: themeColors.textSecondary }]}>
                  Total Budget
                </Text>
                <Text style={[styles.financeTotalValue, { color: themeColors.primary }]}>
                  {formatPrice(finances.totalBudget)}
                </Text>
              </View>

              {/* Finance Categories - NOW CLICKABLE */}
              <View style={styles.financeCategories}>
                {/* Material */}
                <TouchableOpacity
                  style={styles.financeCategory}
                  onPress={() => openFinanceModal('material')}
                  activeOpacity={0.7}
                >
                  <View style={styles.financeCategoryHeader}>
                    <View style={[styles.financeColorDot, { backgroundColor: FINANCE_COLORS.material }]} />
                    <Text style={[styles.financeCategoryName, { color: themeColors.text }]}>
                      Material
                    </Text>
                  </View>
                  <View style={styles.financeCategoryValues}>
                    <Text style={[styles.financeCategoryAmount, { color: themeColors.text }]}>
                      {formatPrice(finances.material.amount)}
                    </Text>
                    <View style={[styles.financePercentageBadge, { backgroundColor: FINANCE_COLORS.material + '20' }]}>
                      <Text style={[styles.financePercentageText, { color: FINANCE_COLORS.material }]}>
                        {finances.material.percentage}%
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={18}
                      color={themeColors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Subunternehmer */}
                <TouchableOpacity
                  style={styles.financeCategory}
                  onPress={() => openFinanceModal('subcontractor')}
                  activeOpacity={0.7}
                >
                  <View style={styles.financeCategoryHeader}>
                    <View style={[styles.financeColorDot, { backgroundColor: FINANCE_COLORS.subcontractor }]} />
                    <Text style={[styles.financeCategoryName, { color: themeColors.text }]}>
                      Subunternehmer Rechnungen
                    </Text>
                  </View>
                  <View style={styles.financeCategoryValues}>
                    <Text style={[styles.financeCategoryAmount, { color: themeColors.text }]}>
                      {formatPrice(finances.subcontractor.amount)}
                    </Text>
                    <View style={[styles.financePercentageBadge, { backgroundColor: FINANCE_COLORS.subcontractor + '20' }]}>
                      <Text style={[styles.financePercentageText, { color: FINANCE_COLORS.subcontractor }]}>
                        {finances.subcontractor.percentage}%
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={18}
                      color={themeColors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Externe Rechnungen */}
                <TouchableOpacity
                  style={styles.financeCategory}
                  onPress={() => openFinanceModal('external')}
                  activeOpacity={0.7}
                >
                  <View style={styles.financeCategoryHeader}>
                    <View style={[styles.financeColorDot, { backgroundColor: FINANCE_COLORS.external }]} />
                    <Text style={[styles.financeCategoryName, { color: themeColors.text }]}>
                      Externe Rechnungen
                    </Text>
                  </View>
                  <View style={styles.financeCategoryValues}>
                    <Text style={[styles.financeCategoryAmount, { color: themeColors.text }]}>
                      {formatPrice(finances.external.amount)}
                    </Text>
                    <View style={[styles.financePercentageBadge, { backgroundColor: FINANCE_COLORS.external + '20' }]}>
                      <Text style={[styles.financePercentageText, { color: FINANCE_COLORS.external }]}>
                        {finances.external.percentage}%
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={18}
                      color={themeColors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Labor (Lohnkosten) */}
                <TouchableOpacity
                  style={styles.financeCategory}
                  onPress={() => openFinanceModal('labor')}
                  activeOpacity={0.7}
                >
                  <View style={styles.financeCategoryHeader}>
                    <View style={[styles.financeColorDot, { backgroundColor: FINANCE_COLORS.labor }]} />
                    <Text style={[styles.financeCategoryName, { color: themeColors.text }]}>
                      Labor (Lohnkosten)
                    </Text>
                  </View>
                  <View style={styles.financeCategoryValues}>
                    <Text style={[styles.financeCategoryAmount, { color: themeColors.text }]}>
                      {formatPrice(finances.labor.amount)}
                    </Text>
                    <View style={[styles.financePercentageBadge, { backgroundColor: FINANCE_COLORS.labor + '20' }]}>
                      <Text style={[styles.financePercentageText, { color: FINANCE_COLORS.labor }]}>
                        {finances.labor.percentage}%
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={18}
                      color={themeColors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Rest */}
                <TouchableOpacity
                  style={styles.financeCategory}
                  onPress={() => openFinanceModal('rest')}
                  activeOpacity={0.7}
                >
                  <View style={styles.financeCategoryHeader}>
                    <View style={[styles.financeColorDot, { backgroundColor: FINANCE_COLORS.rest }]} />
                    <Text style={[styles.financeCategoryName, { color: themeColors.text }]}>
                      Rest
                    </Text>
                  </View>
                  <View style={styles.financeCategoryValues}>
                    <Text style={[styles.financeCategoryAmount, { color: themeColors.text }]}>
                      {formatPrice(finances.rest.amount)}
                    </Text>
                    <View style={[styles.financePercentageBadge, { backgroundColor: FINANCE_COLORS.rest + '20' }]}>
                      <Text style={[styles.financePercentageText, { color: FINANCE_COLORS.rest }]}>
                        {finances.rest.percentage}%
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward"
                      size={18}
                      color={themeColors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Gewerke Timeline Section */}
        {gewerkeTimeline.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <View style={[styles.timelineCard, { backgroundColor: themeColors.card }, shadows.large]}>
              <View style={styles.timelineHeader}>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="schedule"
                  size={24}
                  color={themeColors.primary}
                />
                <Text style={[styles.timelineTitle, { color: themeColors.text }]}>
                  Gewerke Timeline
                </Text>
              </View>
              
              <View style={styles.timelineContent}>
                {gewerkeTimeline.map((entry, index) => {
                  const gewerkeColor = getGewerkeColor(entry.gewerke);
                  return (
                    <React.Fragment key={index}>
                      <View style={styles.timelineEntry}>
                        {/* Timeline connector line */}
                        {index < gewerkeTimeline.length - 1 && (
                          <View style={[styles.timelineConnector, { backgroundColor: themeColors.border }]} />
                        )}
                        
                        {/* Timeline dot */}
                        <View style={[styles.timelineDot, { backgroundColor: gewerkeColor }]} />
                        
                        {/* Timeline content */}
                        <View style={styles.timelineEntryContent}>
                          <View style={styles.timelineEntryHeader}>
                            <Text style={[styles.timelineGewerkeName, { color: gewerkeColor }]}>
                              {entry.gewerke}
                            </Text>
                            {entry.phase && (
                              <View style={[styles.timelinePhaseBadge, { backgroundColor: gewerkeColor + '20' }]}>
                                <Text style={[styles.timelinePhaseText, { color: gewerkeColor }]}>
                                  {entry.phase}
                                </Text>
                              </View>
                            )}
                          </View>
                          
                          <View style={styles.timelineDates}>
                            <View style={styles.timelineDateItem}>
                              <IconSymbol
                                ios_icon_name="calendar"
                                android_material_icon_name="calendar-today"
                                size={14}
                                color={themeColors.textSecondary}
                              />
                              <Text style={[styles.timelineDateText, { color: themeColors.textSecondary }]}>
                                {entry.startDate}
                              </Text>
                            </View>
                            
                            <IconSymbol
                              ios_icon_name="arrow.right"
                              android_material_icon_name="arrow-forward"
                              size={14}
                              color={themeColors.textSecondary}
                            />
                            
                            <View style={styles.timelineDateItem}>
                              <IconSymbol
                                ios_icon_name="calendar"
                                android_material_icon_name="event"
                                size={14}
                                color={themeColors.textSecondary}
                              />
                              <Text style={[styles.timelineDateText, { color: themeColors.textSecondary }]}>
                                {entry.endDate}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Summary Card - NOW USES UPDATED CALCULATION FUNCTIONS */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <View style={[styles.summaryCard, { backgroundColor: themeColors.card }, shadows.medium]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                  Total Positions
                </Text>
                <Text style={[styles.summaryValue, { color: themeColors.text }]}>
                  {calculateTotalPositions()}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>
                  Total Value
                </Text>
                <Text style={[styles.summaryValue, { color: themeColors.primary }]}>
                  {formatPrice(calculateTotalPrice())}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Positions Section - Grouped by Gewerke */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              Leistungsverzeichnis (LV)
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: themeColors.primary }]}
              onPress={() => console.log('ProjectDetailScreen: User tapped add position')}
              activeOpacity={0.8}
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {Object.keys(groupedPositions).length === 0 ? (
            <View style={[styles.emptyPositionsCard, { backgroundColor: themeColors.card }, shadows.small]}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={48}
                color={themeColors.textSecondary}
              />
              <Text style={[styles.emptyPositionsText, { color: themeColors.textSecondary }]}>
                No positions added yet
              </Text>
              <Text style={[styles.emptyPositionsSubtext, { color: themeColors.textSecondary }]}>
                Tap the + button to add your first position
              </Text>
            </View>
          ) : (
            Object.entries(groupedPositions).map(([gewerkeName, gewerkePositions], gewerkeIndex) => {
              const gewerkeColor = getGewerkeColor(gewerkeName);
              const gewerkeSubtotal = calculateGewerkeSubtotal(gewerkePositions);
              
              return (
                <React.Fragment key={gewerkeName}>
                  <Animated.View
                    entering={FadeInDown.delay(500 + gewerkeIndex * 100).duration(600)}
                    style={styles.gewerkeSection}
                  >
                    {/* Gewerke Header with Subtotal */}
                    <View style={[styles.gewerkeHeader, { backgroundColor: gewerkeColor + '20' }]}>
                      <View style={styles.gewerkeHeaderLeft}>
                        <View style={[styles.gewerkeColorDot, { backgroundColor: gewerkeColor }]} />
                        <View style={styles.gewerkeHeaderInfo}>
                          <Text style={[styles.gewerkeName, { color: themeColors.text }]}>
                            {gewerkeName}
                          </Text>
                          <Text style={[styles.gewerkeSubtotal, { color: gewerkeColor }]}>
                            Subtotal: {formatPrice(gewerkeSubtotal)}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.gewerkeCountBadge, { backgroundColor: gewerkeColor }]}>
                        <Text style={styles.gewerkeCountText}>
                          {gewerkePositions.length}
                        </Text>
                      </View>
                    </View>

                    {/* Positions in this Gewerke with numbering */}
                    {gewerkePositions.map((position, posIndex) => {
                      // Position number within this Gewerke group (1-indexed)
                      const positionNumber = posIndex + 1;
                      const hasLangtext = langtextMap[position.position_id];
                      
                      // Get subcontractor-specific color if applicable
                      const companyBadgeColor = position.is_subcontractor_assigned && position.resolved_company_name
                        ? subcontractorColorMap.get(position.resolved_company_name) || '#F59E0B'
                        : '#9CA3AF'; // Gray for contractor
                      
                      return (
                        <TouchableOpacity
                          key={position.position_id || position.id || `${gewerkeName}-${posIndex}`}
                          style={[
                            styles.positionCard,
                            { backgroundColor: themeColors.card },
                            shadows.small,
                          ]}
                          onPress={() => console.log('ProjectDetailScreen: User tapped position', position.position_id)}
                          activeOpacity={0.7}
                        >
                          {/* Position Number Badge */}
                          <View style={[styles.positionNumberBadge, { backgroundColor: gewerkeColor }]}>
                            <Text style={styles.positionNumberText}>
                              {positionNumber}
                            </Text>
                          </View>

                          {/* Position Header - Position ID now uses Gewerke color */}
                          <View style={styles.positionHeader}>
                            <View style={styles.positionHeaderLeft}>
                              <Text style={[styles.positionId, { color: gewerkeColor }]}>
                                {position.position_id || `Position ${positionNumber}`}
                              </Text>
                              {position.status && (
                                <View
                                  style={[
                                    styles.positionStatusBadge,
                                    { backgroundColor: getPositionStatusColor(position.status) + '20' },
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.positionStatusDot,
                                      { backgroundColor: getPositionStatusColor(position.status) },
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.positionStatusText,
                                      { color: getPositionStatusColor(position.status) },
                                    ]}
                                  >
                                    {position.status}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Company Name Badge with Subcontractor-Specific Color */}
                          {position.resolved_company_name && (
                            <View
                              style={[
                                styles.companyNameContainer,
                                {
                                  backgroundColor: companyBadgeColor + '15',
                                },
                              ]}
                            >
                              <IconSymbol
                                ios_icon_name="building.2"
                                android_material_icon_name="business"
                                size={14}
                                color={companyBadgeColor}
                              />
                              <Text
                                style={[
                                  styles.companyNameText,
                                  {
                                    color: companyBadgeColor,
                                  },
                                ]}
                              >
                                {position.resolved_company_name}
                              </Text>
                              {/* Assignment Type Indicator */}
                              {position.is_subcontractor_assigned && (
                                <View
                                  style={[
                                    styles.assignmentTypeBadge,
                                    { backgroundColor: companyBadgeColor },
                                  ]}
                                >
                                  <Text style={styles.assignmentTypeText}>
                                    {position.assignment_type === 'trade' ? 'T' : 'P'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Position Description (Clean - without locations) */}
                          <Text style={[styles.positionShortDesc, { color: themeColors.text }]}>
                            {position.clean_description || position.description || position.short_description || 'No description'}
                          </Text>

                          {/* Location Badges (Extracted from description) */}
                          {position.locations && position.locations.length > 0 && (
                            <View style={styles.locationBadgesContainer}>
                              {position.locations.map((location, locIndex) => (
                                <View key={locIndex} style={styles.locationBadge}>
                                  <Text style={styles.locationBadgeText}>
                                    {location}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* View Details Link (if langtext exists) */}
                          {hasLangtext && (
                            <TouchableOpacity
                              style={styles.viewDetailsLink}
                              onPress={() => openLangtextModal(position)}
                              activeOpacity={0.7}
                            >
                              <IconSymbol
                                ios_icon_name="doc.text"
                                android_material_icon_name="description"
                                size={14}
                                color={themeColors.primary}
                              />
                              <Text style={[styles.viewDetailsText, { color: themeColors.primary }]}>
                                View Details
                              </Text>
                            </TouchableOpacity>
                          )}

                          {position.long_description && (
                            <Text
                              style={[styles.positionLongDesc, { color: themeColors.textSecondary }]}
                              numberOfLines={2}
                            >
                              {position.long_description}
                            </Text>
                          )}

                          {/* Position Details */}
                          <View style={styles.positionDetails}>
                            <View style={styles.positionDetailItem}>
                              <IconSymbol
                                ios_icon_name="number"
                                android_material_icon_name="tag"
                                size={14}
                                color={themeColors.textSecondary}
                              />
                              <Text style={[styles.positionDetailText, { color: themeColors.textSecondary }]}>
                                {position.quantity || 0} {position.unit || 'Stück'}
                              </Text>
                            </View>
                            <View style={styles.positionDetailItem}>
                              <IconSymbol
                                ios_icon_name="eurosign.circle"
                                android_material_icon_name="euro"
                                size={14}
                                color={themeColors.textSecondary}
                              />
                              <Text style={[styles.positionDetailText, { color: themeColors.textSecondary }]}>
                                {formatPrice(position.unit_price || 0)} / {position.unit || 'Stück'}
                              </Text>
                            </View>
                          </View>

                          {/* Position Total */}
                          <View style={[styles.positionTotal, { borderTopColor: themeColors.border }]}>
                            <Text style={[styles.positionTotalLabel, { color: themeColors.textSecondary }]}>
                              Total
                            </Text>
                            <Text style={[styles.positionTotalValue, { color: themeColors.primary }]}>
                              {formatPrice(position.total_price || 0)}
                            </Text>
                          </View>

                          {position.cancellation_note && (
                            <View style={[styles.cancellationNote, { backgroundColor: themeColors.error + '15' }]}>
                              <IconSymbol
                                ios_icon_name="exclamationmark.triangle"
                                android_material_icon_name="warning"
                                size={14}
                                color={themeColors.error}
                              />
                              <Text style={[styles.cancellationNoteText, { color: themeColors.error }]}>
                                {position.cancellation_note}
                              </Text>
                            </View>
                          )}

                          {/* Nachtrag Information */}
                          {position.nachtrag_number && (
                            <View style={[styles.nachtragInfo, { backgroundColor: themeColors.warning + '15' }]}>
                              <IconSymbol
                                ios_icon_name="info.circle"
                                android_material_icon_name="info"
                                size={14}
                                color={themeColors.warning}
                              />
                              <Text style={[styles.nachtragText, { color: themeColors.warning }]}>
                                Nachtrag #{position.nachtrag_number}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </Animated.View>
                </React.Fragment>
              );
            })
          )}
        </Animated.View>

        {/* Nachträge Section - MOVED TO THE END */}
        {nachtraege.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(600)}>
            <View style={[styles.nachtraegeCard, { backgroundColor: themeColors.card }, shadows.large]}>
              <View style={styles.nachtraegeHeader}>
                <IconSymbol
                  ios_icon_name="doc.badge.plus"
                  android_material_icon_name="note-add"
                  size={24}
                  color="#EC4899"
                />
                <Text style={[styles.nachtraegeTitle, { color: themeColors.text }]}>
                  Nachträge
                </Text>
                <View style={[styles.nachtraegeCountBadge, { backgroundColor: '#EC4899' }]}>
                  <Text style={styles.nachtraegeCountText}>
                    {nachtraege.length}
                  </Text>
                </View>
              </View>

              <View style={styles.nachtraegeList}>
                {nachtraege.map((nachtrag, index) => {
                  const statusColor = getNachtragStatusColor(nachtrag.status);
                  const gewerkeNames = nachtrag.positions
                    .map(p => p.gewerke_name)
                    .filter((v, i, a) => v && a.indexOf(v) === i); // Unique gewerke names
                  
                  return (
                    <React.Fragment key={nachtrag.id}>
                      <TouchableOpacity
                        style={[
                          styles.nachtragCard,
                          { 
                            backgroundColor: themeColors.background,
                            borderLeftColor: '#EC4899',
                            borderLeftWidth: 4,
                          }
                        ]}
                        onPress={() => openNachtragModal(nachtrag)}
                        activeOpacity={0.7}
                      >
                        {/* Nachtrag Header */}
                        <View style={styles.nachtragHeader}>
                          <View style={styles.nachtragHeaderLeft}>
                            <View style={[styles.nachtragBadge, { backgroundColor: '#EC4899' + '20' }]}>
                              <Text style={[styles.nachtragBadgeText, { color: '#EC4899' }]}>
                                {nachtrag.addendum_number}
                              </Text>
                            </View>
                            <View style={[styles.nachtragStatusBadge, { backgroundColor: statusColor + '20' }]}>
                              <View style={[styles.nachtragStatusDot, { backgroundColor: statusColor }]} />
                              <Text style={[styles.nachtragStatusText, { color: statusColor }]}>
                                {nachtrag.status}
                              </Text>
                            </View>
                          </View>
                          <IconSymbol
                            ios_icon_name="chevron.right"
                            android_material_icon_name="arrow-forward"
                            size={18}
                            color={themeColors.textSecondary}
                          />
                        </View>

                        {/* Nachtrag Title */}
                        <Text style={[styles.nachtragTitle, { color: themeColors.text }]}>
                          {nachtrag.title}
                        </Text>

                        {/* Gewerke Tags */}
                        {gewerkeNames.length > 0 && (
                          <View style={styles.nachtragGewerkeContainer}>
                            {gewerkeNames.map((gewerkeName, idx) => {
                              const gewerkeColor = getGewerkeColor(gewerkeName || 'Sonstiges');
                              return (
                                <View
                                  key={idx}
                                  style={[styles.nachtragGewerkeTag, { backgroundColor: gewerkeColor + '20' }]}
                                >
                                  <View style={[styles.nachtragGewerkeTagDot, { backgroundColor: gewerkeColor }]} />
                                  <Text style={[styles.nachtragGewerkeTagText, { color: gewerkeColor }]}>
                                    {gewerkeName}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* Nachtrag Details */}
                        <View style={styles.nachtragDetails}>
                          <View style={styles.nachtragDetailItem}>
                            <IconSymbol
                              ios_icon_name="doc.text"
                              android_material_icon_name="description"
                              size={14}
                              color={themeColors.textSecondary}
                            />
                            <Text style={[styles.nachtragDetailText, { color: themeColors.textSecondary }]}>
                              {nachtrag.positions.length} Position{nachtrag.positions.length !== 1 ? 'en' : ''}
                            </Text>
                          </View>
                          <View style={styles.nachtragDetailItem}>
                            <IconSymbol
                              ios_icon_name="calendar"
                              android_material_icon_name="calendar-today"
                              size={14}
                              color={themeColors.textSecondary}
                            />
                            <Text style={[styles.nachtragDetailText, { color: themeColors.textSecondary }]}>
                              {formatDate(nachtrag.created_at)}
                            </Text>
                          </View>
                        </View>

                        {/* Nachtrag Total Value */}
                        <View style={[styles.nachtragTotal, { borderTopColor: themeColors.border }]}>
                          <Text style={[styles.nachtragTotalLabel, { color: themeColors.textSecondary }]}>
                            Total Value
                          </Text>
                          <Text style={[styles.nachtragTotalValue, { color: '#EC4899' }]}>
                            {formatPrice(nachtrag.total_value)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Langtext Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeLangtextModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <View style={styles.modalHeaderLeft}>
                <IconSymbol
                  ios_icon_name="doc.text"
                  android_material_icon_name="description"
                  size={24}
                  color={themeColors.primary}
                />
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  Position Details
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeLangtextModal}
                activeOpacity={0.7}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={themeColors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
            >
              {selectedPosition && (
                <>
                  {/* Position ID */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Position ID
                    </Text>
                    <Text style={[styles.modalSectionValue, { color: themeColors.primary }]}>
                      {selectedPosition.position_id}
                    </Text>
                  </View>

                  {/* Locations (if exists) */}
                  {selectedPosition.locations && selectedPosition.locations.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                        Execution Locations
                      </Text>
                      <View style={styles.locationBadgesContainer}>
                        {selectedPosition.locations.map((location, locIndex) => (
                          <View key={locIndex} style={styles.locationBadge}>
                            <Text style={styles.locationBadgeText}>
                              {location}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Short Description */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Short Description
                    </Text>
                    <Text style={[styles.modalSectionValue, { color: themeColors.text }]}>
                      {selectedPosition.clean_description || selectedPosition.description || selectedPosition.short_description || 'No description'}
                    </Text>
                  </View>

                  {/* Long Description (Langtext) */}
                  {langtextMap[selectedPosition.position_id] && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                        Long Description (Langtext)
                      </Text>
                      <View style={[styles.langtextContainer, { backgroundColor: themeColors.background }]}>
                        <Text style={[styles.langtextText, { color: themeColors.text }]}>
                          {langtextMap[selectedPosition.position_id]}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Position Details */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Quantity & Pricing
                    </Text>
                    <View style={styles.modalDetailsGrid}>
                      <View style={styles.modalDetailItem}>
                        <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                          Quantity
                        </Text>
                        <Text style={[styles.modalDetailValue, { color: themeColors.text }]}>
                          {selectedPosition.quantity || 0} {selectedPosition.unit || 'Stück'}
                        </Text>
                      </View>
                      <View style={styles.modalDetailItem}>
                        <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                          Unit Price
                        </Text>
                        <Text style={[styles.modalDetailValue, { color: themeColors.text }]}>
                          {formatPrice(selectedPosition.unit_price || 0)}
                        </Text>
                      </View>
                      <View style={styles.modalDetailItem}>
                        <Text style={[styles.modalDetailLabel, { color: themeColors.textSecondary }]}>
                          Total Price
                        </Text>
                        <Text style={[styles.modalDetailValue, { color: themeColors.primary }]}>
                          {formatPrice(selectedPosition.total_price || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: themeColors.border }]}>
              <TouchableOpacity
                style={[styles.modalCloseButtonLarge, { backgroundColor: themeColors.primary }]}
                onPress={closeLangtextModal}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Nachtrag Details Modal */}
      <Modal
        visible={nachtragModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeNachtragModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <View style={styles.modalHeaderLeft}>
                <IconSymbol
                  ios_icon_name="doc.badge.plus"
                  android_material_icon_name="note-add"
                  size={24}
                  color="#EC4899"
                />
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  Nachtrag Details
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeNachtragModal}
                activeOpacity={0.7}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={themeColors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
            >
              {selectedNachtrag && (
                <>
                  {/* Nachtrag Number */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Nachtrag Number
                    </Text>
                    <View style={[styles.nachtragBadge, { backgroundColor: '#EC4899' + '20' }]}>
                      <Text style={[styles.nachtragBadgeText, { color: '#EC4899' }]}>
                        {selectedNachtrag.addendum_number}
                      </Text>
                    </View>
                  </View>

                  {/* Status */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Status
                    </Text>
                    <View
                      style={[
                        styles.nachtragStatusBadge,
                        { backgroundColor: getNachtragStatusColor(selectedNachtrag.status) + '20' },
                      ]}
                    >
                      <View
                        style={[
                          styles.nachtragStatusDot,
                          { backgroundColor: getNachtragStatusColor(selectedNachtrag.status) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.nachtragStatusText,
                          { color: getNachtragStatusColor(selectedNachtrag.status) },
                        ]}
                      >
                        {selectedNachtrag.status}
                      </Text>
                    </View>
                  </View>

                  {/* Title */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Title
                    </Text>
                    <Text style={[styles.modalSectionValue, { color: themeColors.text }]}>
                      {selectedNachtrag.title}
                    </Text>
                  </View>

                  {/* Description */}
                  {selectedNachtrag.description && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                        Description
                      </Text>
                      <Text style={[styles.modalSectionValue, { color: themeColors.text }]}>
                        {selectedNachtrag.description}
                      </Text>
                    </View>
                  )}

                  {/* Total Value */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Total Value
                    </Text>
                    <Text style={[styles.modalSectionValue, { color: '#EC4899', fontSize: 24, fontWeight: '700' }]}>
                      {formatPrice(selectedNachtrag.total_value)}
                    </Text>
                  </View>

                  {/* Positions */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Positions ({selectedNachtrag.positions.length})
                    </Text>
                    <View style={styles.nachtragPositionsList}>
                      {selectedNachtrag.positions.map((position, index) => {
                        const gewerkeColor = getGewerkeColor(position.gewerke_name || 'Sonstiges');
                        return (
                          <View
                            key={index}
                            style={[
                              styles.nachtragPositionCard,
                              { backgroundColor: themeColors.background, borderLeftColor: gewerkeColor },
                            ]}
                          >
                            {/* Position Header */}
                            <View style={styles.nachtragPositionHeader}>
                              <Text style={[styles.nachtragPositionId, { color: gewerkeColor }]}>
                                {position.position_id}
                              </Text>
                              {position.gewerke_name && (
                                <View style={[styles.nachtragPositionGewerkeTag, { backgroundColor: gewerkeColor + '20' }]}>
                                  <Text style={[styles.nachtragPositionGewerkeText, { color: gewerkeColor }]}>
                                    {position.gewerke_name}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Position Description */}
                            <Text style={[styles.nachtragPositionDesc, { color: themeColors.text }]}>
                              {position.short_description}
                            </Text>

                            {/* Position Details */}
                            <View style={styles.nachtragPositionDetails}>
                              <Text style={[styles.nachtragPositionDetailText, { color: themeColors.textSecondary }]}>
                                {position.quantity} {position.unit} × {formatPrice(position.unit_price)}
                              </Text>
                              <Text style={[styles.nachtragPositionTotal, { color: themeColors.text }]}>
                                {formatPrice(position.total_price)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Notes */}
                  {selectedNachtrag.notes && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                        Notes
                      </Text>
                      <View style={[styles.langtextContainer, { backgroundColor: themeColors.background }]}>
                        <Text style={[styles.langtextText, { color: themeColors.text }]}>
                          {selectedNachtrag.notes}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Created Date */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                      Created
                    </Text>
                    <Text style={[styles.modalSectionValue, { color: themeColors.text }]}>
                      {formatDate(selectedNachtrag.created_at)}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: themeColors.border }]}>
              <TouchableOpacity
                style={[styles.modalCloseButtonLarge, { backgroundColor: themeColors.primary }]}
                onPress={closeNachtragModal}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Finance Category Details Modal */}
      <Modal
        visible={financeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeFinanceModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.financeColorDot, { backgroundColor: getFinanceModalColor() }]} />
                <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                  {getFinanceModalTitle()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeFinanceModal}
                activeOpacity={0.7}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={themeColors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={true}
            >
              {financeModalType === 'material' && financeModalData && (
                <>
                  {financeModalData.length === 0 ? (
                    <View style={styles.emptyFinanceState}>
                      <IconSymbol
                        ios_icon_name="cube.box"
                        android_material_icon_name="inventory"
                        size={48}
                        color={themeColors.textSecondary}
                      />
                      <Text style={[styles.emptyFinanceText, { color: themeColors.textSecondary }]}>
                        No material orders found
                      </Text>
                    </View>
                  ) : (
                    financeModalData.map((order: any, index: number) => {
                      // Calculate Brutto amount (total with VAT)
                      const TVA_RATE = 0.19;
                      const nettoAmount = computeOrderNet(order.products || []);
                      const tvaAmount = nettoAmount * TVA_RATE;
                      const bruttoAmount = nettoAmount + tvaAmount;
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[styles.materialOrderCard, { backgroundColor: themeColors.background }]}
                          onPress={() => {
                            console.log('ProjectDetailScreen: User tapped material order', order.id);
                            closeFinanceModal();
                            router.push({
                              pathname: '/order-detail',
                              params: { id: order.id }
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          {/* Order Number */}
                          <View style={styles.materialOrderRow}>
                            <Text style={[styles.materialOrderLabel, { color: themeColors.textSecondary }]}>
                              Order Number
                            </Text>
                            <Text style={[styles.materialOrderValue, { color: FINANCE_COLORS.material }]} numberOfLines={1}>
                              {order.order_number || order.id.slice(0, 8)}
                            </Text>
                          </View>

                          {/* Orderer */}
                          <View style={styles.materialOrderRow}>
                            <Text style={[styles.materialOrderLabel, { color: themeColors.textSecondary }]}>
                              Orderer
                            </Text>
                            <Text style={[styles.materialOrderValue, { color: themeColors.text }]} numberOfLines={1}>
                              {order.ordered_by?.name || 'N/A'}
                            </Text>
                          </View>

                          {/* Date */}
                          <View style={styles.materialOrderRow}>
                            <Text style={[styles.materialOrderLabel, { color: themeColors.textSecondary }]}>
                              Date
                            </Text>
                            <Text style={[styles.materialOrderValue, { color: themeColors.text }]}>
                              {formatDate(order.created_at)}
                            </Text>
                          </View>

                          {/* Value */}
                          <View style={styles.materialOrderRow}>
                            <Text style={[styles.materialOrderLabel, { color: themeColors.textSecondary }]}>
                              Value
                            </Text>
                            <Text style={[styles.materialOrderValueHighlight, { color: FINANCE_COLORS.material }]}>
                              {formatPrice(bruttoAmount)}
                            </Text>
                          </View>

                          {/* View Details Arrow */}
                          <View style={[styles.materialOrderFooter, { borderTopColor: themeColors.border }]}>
                            <Text style={[styles.materialOrderDetailsText, { color: FINANCE_COLORS.material }]}>
                              View Details
                            </Text>
                            <IconSymbol
                              ios_icon_name="chevron.right"
                              android_material_icon_name="arrow-forward"
                              size={18}
                              color={FINANCE_COLORS.material}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}

              {financeModalType === 'subcontractor' && financeModalData && (
                <>
                  {financeModalData.length === 0 ? (
                    <View style={styles.emptyFinanceState}>
                      <IconSymbol
                        ios_icon_name="person.2"
                        android_material_icon_name="group"
                        size={48}
                        color={themeColors.textSecondary}
                      />
                      <Text style={[styles.emptyFinanceText, { color: themeColors.textSecondary }]}>
                        No subcontractor invoices found
                      </Text>
                    </View>
                  ) : (
                    financeModalData.map((draft: any, index: number) => (
                      <View key={index} style={[styles.financeDetailCard, { backgroundColor: themeColors.background }]}>
                        <View style={styles.financeDetailHeader}>
                          <Text style={[styles.financeDetailTitle, { color: themeColors.text }]}>
                            {draft.subcontractor?.company_name || 'Unknown Subcontractor'}
                          </Text>
                          <View style={[styles.financeDetailBadge, { backgroundColor: FINANCE_COLORS.subcontractor + '20' }]}>
                            <Text style={[styles.financeDetailBadgeText, { color: FINANCE_COLORS.subcontractor }]}>
                              {draft.invoice_number}
                            </Text>
                          </View>
                        </View>
                        {draft.gewerke_names && draft.gewerke_names.length > 0 && (
                          <View style={styles.financeDetailGewerke}>
                            {draft.gewerke_names.map((gewerke: string, gIndex: number) => (
                              <View key={gIndex} style={[styles.financeDetailGewerkeBadge, { backgroundColor: getGewerkeColor(gewerke) + '20' }]}>
                                <Text style={[styles.financeDetailGewerkeText, { color: getGewerkeColor(gewerke) }]}>
                                  {gewerke}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <View style={styles.financeDetailBreakdown}>
                          <View style={styles.financeDetailBreakdownRow}>
                            <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                              Total Amount
                            </Text>
                            <Text style={[styles.financeDetailBreakdownValue, { color: themeColors.text }]}>
                              {formatPrice(draft.total_amount || 0)}
                            </Text>
                          </View>
                          {draft.material_deduction_amount > 0 && (
                            <View style={styles.financeDetailBreakdownRow}>
                              <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                                Material Deduction
                              </Text>
                              <Text style={[styles.financeDetailBreakdownValue, { color: themeColors.error }]}>
                                -{formatPrice(draft.material_deduction_amount)}
                              </Text>
                            </View>
                          )}
                          {draft.extra_deduction_amount > 0 && (
                            <View style={styles.financeDetailBreakdownRow}>
                              <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                                Extra Deduction
                              </Text>
                              <Text style={[styles.financeDetailBreakdownValue, { color: themeColors.error }]}>
                                -{formatPrice(draft.extra_deduction_amount)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.financeDetailTotal, { borderTopColor: themeColors.border }]}>
                          <Text style={[styles.financeDetailTotalLabel, { color: themeColors.textSecondary }]}>
                            Final Amount
                          </Text>
                          <Text style={[styles.financeDetailTotalValue, { color: FINANCE_COLORS.subcontractor }]}>
                            {formatPrice(draft.approved_final_amount || draft.final_amount || 0)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}

              {financeModalType === 'external' && financeModalData && (
                <>
                  {financeModalData.length === 0 ? (
                    <View style={styles.emptyFinanceState}>
                      <IconSymbol
                        ios_icon_name="doc.text"
                        android_material_icon_name="description"
                        size={48}
                        color={themeColors.textSecondary}
                      />
                      <Text style={[styles.emptyFinanceText, { color: themeColors.textSecondary }]}>
                        No external invoices found
                      </Text>
                    </View>
                  ) : (
                    financeModalData.map((invoice: any, index: number) => (
                      <View key={index} style={[styles.financeDetailCard, { backgroundColor: themeColors.background }]}>
                        <View style={styles.financeDetailHeader}>
                          <Text style={[styles.financeDetailTitle, { color: themeColors.text }]}>
                            {invoice.supplier_name || 'Unknown Supplier'}
                          </Text>
                          <View style={[styles.financeDetailBadge, { backgroundColor: FINANCE_COLORS.external + '20' }]}>
                            <Text style={[styles.financeDetailBadgeText, { color: FINANCE_COLORS.external }]}>
                              {invoice.invoice_number}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.financeDetailDate, { color: themeColors.textSecondary }]}>
                          {formatDate(invoice.invoice_date)}
                        </Text>
                        {invoice.description && (
                          <Text style={[styles.financeDetailDescription, { color: themeColors.text }]}>
                            {invoice.description}
                          </Text>
                        )}
                        {invoice.orderer_name && (
                          <View style={styles.financeDetailInfo}>
                            <IconSymbol
                              ios_icon_name="person"
                              android_material_icon_name="person"
                              size={14}
                              color={themeColors.textSecondary}
                            />
                            <Text style={[styles.financeDetailInfoText, { color: themeColors.textSecondary }]}>
                              Ordered by: {invoice.orderer_name}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.financeDetailTotal, { borderTopColor: themeColors.border }]}>
                          <Text style={[styles.financeDetailTotalLabel, { color: themeColors.textSecondary }]}>
                            Amount
                          </Text>
                          <Text style={[styles.financeDetailTotalValue, { color: FINANCE_COLORS.external }]}>
                            {formatPrice(invoice.amount || 0)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}

              {financeModalType === 'labor' && financeModalData && (
                <>
                  {financeModalData.length === 0 ? (
                    <View style={styles.emptyFinanceState}>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="schedule"
                        size={48}
                        color={themeColors.textSecondary}
                      />
                      <Text style={[styles.emptyFinanceText, { color: themeColors.textSecondary }]}>
                        No time entries found
                      </Text>
                    </View>
                  ) : (
                    financeModalData.map((entry: any, index: number) => {
                      const employeeName = entry.employee 
                        ? `${entry.employee.first_name} ${entry.employee.last_name}`
                        : 'Unknown Employee';
                      const hourlyRate = entry.employee?.hourly_rate || 50;
                      const hours = entry.total_hours || 0;
                      const cost = hours * hourlyRate;
                      
                      return (
                        <View key={index} style={[styles.financeDetailCard, { backgroundColor: themeColors.background }]}>
                          <View style={styles.financeDetailHeader}>
                            <Text style={[styles.financeDetailTitle, { color: themeColors.text }]}>
                              {employeeName}
                            </Text>
                            <View style={[styles.financeDetailBadge, { backgroundColor: FINANCE_COLORS.labor + '20' }]}>
                              <Text style={[styles.financeDetailBadgeText, { color: FINANCE_COLORS.labor }]}>
                                {hours.toFixed(1)}h
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.financeDetailDate, { color: themeColors.textSecondary }]}>
                            {formatDate(entry.date)}
                          </Text>
                          <View style={styles.financeDetailBreakdown}>
                            <View style={styles.financeDetailBreakdownRow}>
                              <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                                Hours
                              </Text>
                              <Text style={[styles.financeDetailBreakdownValue, { color: themeColors.text }]}>
                                {hours.toFixed(1)}
                              </Text>
                            </View>
                            <View style={styles.financeDetailBreakdownRow}>
                              <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                                Hourly Rate
                              </Text>
                              <Text style={[styles.financeDetailBreakdownValue, { color: themeColors.text }]}>
                                {formatPrice(hourlyRate)}/h
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.financeDetailTotal, { borderTopColor: themeColors.border }]}>
                            <Text style={[styles.financeDetailTotalLabel, { color: themeColors.textSecondary }]}>
                              Cost
                            </Text>
                            <Text style={[styles.financeDetailTotalValue, { color: FINANCE_COLORS.labor }]}>
                              {formatPrice(cost)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </>
              )}

              {financeModalType === 'rest' && financeModalData && (
                <View style={[styles.financeDetailCard, { backgroundColor: themeColors.background }]}>
                  <Text style={[styles.financeDetailTitle, { color: themeColors.text, marginBottom: spacing.md }]}>
                    Calculation Breakdown
                  </Text>
                  <View style={styles.financeDetailBreakdown}>
                    <View style={styles.financeDetailBreakdownRow}>
                      <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.text, fontWeight: '700' }]}>
                        Total Budget
                      </Text>
                      <Text style={[styles.financeDetailBreakdownValue, { color: themeColors.text, fontWeight: '700' }]}>
                        {formatPrice(financeModalData.totalBudget)}
                      </Text>
                    </View>
                    <View style={[styles.financeDetailDivider, { backgroundColor: themeColors.border }]} />
                    <View style={styles.financeDetailBreakdownRow}>
                      <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                        - Material
                      </Text>
                      <Text style={[styles.financeDetailBreakdownValue, { color: FINANCE_COLORS.material }]}>
                        {formatPrice(financeModalData.material)}
                      </Text>
                    </View>
                    <View style={styles.financeDetailBreakdownRow}>
                      <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                        - Subunternehmer
                      </Text>
                      <Text style={[styles.financeDetailBreakdownValue, { color: FINANCE_COLORS.subcontractor }]}>
                        {formatPrice(financeModalData.subcontractor)}
                      </Text>
                    </View>
                    <View style={styles.financeDetailBreakdownRow}>
                      <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                        - Externe Rechnungen
                      </Text>
                      <Text style={[styles.financeDetailBreakdownValue, { color: FINANCE_COLORS.external }]}>
                        {formatPrice(financeModalData.external)}
                      </Text>
                    </View>
                    <View style={styles.financeDetailBreakdownRow}>
                      <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.textSecondary }]}>
                        - Labor
                      </Text>
                      <Text style={[styles.financeDetailBreakdownValue, { color: FINANCE_COLORS.labor }]}>
                        {formatPrice(financeModalData.labor)}
                      </Text>
                    </View>
                    <View style={[styles.financeDetailDivider, { backgroundColor: themeColors.border }]} />
                    <View style={styles.financeDetailBreakdownRow}>
                      <Text style={[styles.financeDetailBreakdownLabel, { color: themeColors.text, fontWeight: '700' }]}>
                        = Rest
                      </Text>
                      <Text style={[styles.financeDetailBreakdownValue, { color: FINANCE_COLORS.rest, fontWeight: '700', fontSize: 20 }]}>
                        {formatPrice(financeModalData.rest)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: themeColors.border }]}>
              <TouchableOpacity
                style={[styles.modalCloseButtonLarge, { backgroundColor: getFinanceModalColor() }]}
                onPress={closeFinanceModal}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontWeight: '700',
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  backButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // New comprehensive project info card styles
  projectInfoCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  projectInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  projectExternalId: {
    fontSize: 24,
    fontWeight: '700',
  },
  companyBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  companyBadgeText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  projectInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  projectInfoRowDouble: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  projectInfoRowHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  projectInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectInfoContent: {
    flex: 1,
  },
  projectInfoLabel: {
    ...typography.bodySmall,
    fontSize: 12,
    marginBottom: 2,
  },
  projectInfoValue: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 20,
  },
  projectInfoValueLink: {
    ...typography.body,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Finanzen Card Styles
  financeCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  financeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  financeTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  financeTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
  },
  financeTotalLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  financeTotalValue: {
    ...typography.h2,
    fontWeight: '700',
  },
  financeCategories: {
    gap: spacing.md,
  },
  financeCategory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  financeCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  financeColorDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
  },
  financeCategoryName: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  financeCategoryValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  financeCategoryAmount: {
    ...typography.body,
    fontWeight: '700',
  },
  financePercentageBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    minWidth: 50,
    alignItems: 'center',
  },
  financePercentageText: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 12,
  },
  // Finance Detail Modal Styles
  emptyFinanceState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyFinanceText: {
    ...typography.body,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  financeDetailCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  financeDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  financeDetailTitle: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
  },
  financeDetailBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  financeDetailBadgeText: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 11,
  },
  financeDetailDate: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  financeDetailDescription: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  financeDetailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  financeDetailInfoText: {
    ...typography.bodySmall,
  },
  financeDetailProducts: {
    marginBottom: spacing.sm,
  },
  financeDetailProductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  financeDetailProductName: {
    ...typography.bodySmall,
    flex: 1,
  },
  financeDetailProductQty: {
    ...typography.bodySmall,
    marginHorizontal: spacing.sm,
  },
  financeDetailProductPrice: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  financeDetailGewerke: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  financeDetailGewerkeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  financeDetailGewerkeText: {
    ...typography.bodySmall,
    fontWeight: '600',
    fontSize: 11,
  },
  financeDetailBreakdown: {
    marginBottom: spacing.sm,
  },
  financeDetailBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  financeDetailBreakdownLabel: {
    ...typography.bodySmall,
  },
  financeDetailBreakdownValue: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  financeDetailDivider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  financeDetailTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  financeDetailTotalLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  financeDetailTotalValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  // Material Order Card Styles (Simplified)
  materialOrderCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  materialOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  materialOrderLabel: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 100,
  },
  materialOrderValue: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  materialOrderValueHighlight: {
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  materialOrderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.xs,
  },
  materialOrderDetailsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Gewerke Timeline Styles
  timelineCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  timelineTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  timelineContent: {
    paddingLeft: spacing.sm,
  },
  timelineEntry: {
    position: 'relative',
    paddingLeft: spacing.lg,
    paddingBottom: spacing.lg,
  },
  timelineConnector: {
    position: 'absolute',
    left: 5,
    top: 20,
    width: 2,
    height: '100%',
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
  },
  timelineEntryContent: {
    flex: 1,
  },
  timelineEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  timelineGewerkeName: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  timelinePhaseBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  timelinePhaseText: {
    ...typography.bodySmall,
    fontWeight: '600',
    fontSize: 11,
  },
  timelineDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  timelineDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timelineDateText: {
    ...typography.bodySmall,
    fontSize: 13,
  },
  // Nachträge Card Styles
  nachtraegeCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
  },
  nachtraegeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  nachtraegeTitle: {
    ...typography.h3,
    fontWeight: '700',
    flex: 1,
  },
  nachtraegeCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  nachtraegeCountText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  nachtraegeList: {
    gap: spacing.md,
  },
  nachtragCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  nachtragHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nachtragHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  nachtragBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  nachtragBadgeText: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 12,
  },
  nachtragStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  nachtragStatusDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  nachtragStatusText: {
    ...typography.bodySmall,
    fontWeight: '600',
    textTransform: 'capitalize',
    fontSize: 11,
  },
  nachtragTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  nachtragGewerkeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  nachtragGewerkeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  nachtragGewerkeTagDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  nachtragGewerkeTagText: {
    ...typography.bodySmall,
    fontWeight: '600',
    fontSize: 11,
  },
  nachtragDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  nachtragDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nachtragDetailText: {
    ...typography.bodySmall,
  },
  nachtragTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  nachtragTotalLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  nachtragTotalValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  // Nachtrag Modal Positions List
  nachtragPositionsList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  nachtragPositionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
  },
  nachtragPositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  nachtragPositionId: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  nachtragPositionGewerkeTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
  },
  nachtragPositionGewerkeText: {
    ...typography.bodySmall,
    fontWeight: '600',
    fontSize: 10,
  },
  nachtragPositionDesc: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  nachtragPositionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nachtragPositionDetailText: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  nachtragPositionTotal: {
    ...typography.body,
    fontWeight: '700',
  },
  summaryCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.h2,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginHorizontal: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPositionsCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  emptyPositionsText: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptyPositionsSubtext: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  gewerkeSection: {
    marginBottom: spacing.lg,
  },
  gewerkeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  gewerkeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  gewerkeHeaderInfo: {
    flex: 1,
  },
  gewerkeColorDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
  },
  gewerkeName: {
    ...typography.h4,
    fontWeight: '700',
    marginBottom: 2,
  },
  gewerkeSubtotal: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 13,
  },
  gewerkeCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  gewerkeCountText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  positionCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  positionNumberBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  positionNumberText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingRight: 40, // Make room for position number badge
  },
  positionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  positionId: {
    ...typography.body,
    fontWeight: '700',
    // Color is now set dynamically to match Gewerke color
  },
  positionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  positionStatusDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  positionStatusText: {
    ...typography.bodySmall,
    fontWeight: '600',
    textTransform: 'capitalize',
    fontSize: 11,
  },
  companyNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  companyNameText: {
    ...typography.bodySmall,
    fontWeight: '700',
    fontSize: 12,
  },
  assignmentTypeBadge: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  assignmentTypeText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  positionShortDesc: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  locationBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  locationBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: '#F97316', // Orange color for location badges
    borderRadius: borderRadius.md,
  },
  locationBadgeText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  viewDetailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  viewDetailsText: {
    ...typography.bodySmall,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  positionLongDesc: {
    ...typography.bodySmall,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  positionDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  positionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionDetailText: {
    ...typography.bodySmall,
  },
  positionTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  positionTotalLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  positionTotalValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  cancellationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  cancellationNoteText: {
    ...typography.bodySmall,
    flex: 1,
  },
  nachtragInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  nachtragText: {
    ...typography.bodySmall,
    flex: 1,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: spacing.lg,
  },
  modalSection: {
    marginBottom: spacing.lg,
  },
  modalSectionLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSectionValue: {
    ...typography.body,
    lineHeight: 22,
  },
  langtextContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
  },
  langtextText: {
    ...typography.body,
    lineHeight: 24,
  },
  modalDetailsGrid: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  modalDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  modalDetailLabel: {
    ...typography.body,
  },
  modalDetailValue: {
    ...typography.body,
    fontWeight: '600',
  },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  modalCloseButtonLarge: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
