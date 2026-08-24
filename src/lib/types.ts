export type UserRole = 'farmer' | 'champion' | 'buyer' | 'admin';
export type Language = 'en' | 'hi' | 'bn' | 'mr' | 'ta';
export type ChampionVerificationStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface Profile {
  id: string;
  role: UserRole;
  roles: UserRole[];
  active_role: UserRole;
  full_name: string;
  phone: string;
  email: string;
  village: string;
  district: string;
  state: string;
  preferred_language: string;
  avatar_url: string;
  points_balance: number;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  champion_certificate_url: string;
  champion_verified: boolean;
  champion_verification_status: ChampionVerificationStatus;
  champion_verification_notes: string;
  champion_certificate_type: string;
  champion_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Village {
  id: string;
  name: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  champion_id: string | null;
}

export interface Farm {
  id: string;
  user_id: string;
  village_id: string | null;
  name: string;
  size_acres: number;
  location: string;
  latitude: number | null;
  longitude: number | null;
  soil_type: string;
  irrigation_source: string;
  created_at: string;
}

export interface Crop {
  id: string;
  name: string;
  category: string;
  season: string;
  unit: string;
}

export interface FarmCrop {
  id: string;
  farm_id: string;
  crop_id: string | null;
  crop_name: string;
  area_acres: number;
  planting_date: string | null;
  expected_harvest_date: string | null;
  expected_yield_kg: number;
  status: string;
}

export interface FarmCluster {
  id: string;
  name: string;
  village_id: string | null;
  crop_name: string;
  champion_id: string | null;
  expected_harvest_date: string | null;
  created_at: string;
}

export interface ClusterMember {
  id: string;
  cluster_id: string;
  farm_id: string;
  user_id: string;
  joined_at: string;
}

export interface BulkOrder {
  id: string;
  title: string;
  item_name: string;
  category: string;
  unit: string;
  target_quantity: number;
  estimated_bulk_price: number;
  individual_price: number;
  cluster_id: string | null;
  village_id: string | null;
  created_by: string;
  status: string;
  notes: string;
  closes_on: string | null;
  created_at: string;
}

export interface BulkOrderItem {
  id: string;
  bulk_order_id: string;
  user_id: string;
  quantity: number;
  notes: string;
  created_at: string;
}

export interface Machinery {
  id: string;
  name: string;
  type: string;
  owner_id: string;
  village_id: string | null;
  location: string;
  price_per_hour: number;
  image_url: string;
  is_available: boolean;
  rating: number;
}

export interface MachineryBooking {
  id: string;
  machinery_id: string;
  user_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  location: string;
  total_price: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface Harvest {
  id: string;
  farm_id: string;
  user_id: string;
  crop_name: string;
  expected_quantity_kg: number;
  harvest_date: string | null;
  quality_grade: string;
  location: string;
  status: string;
}

export interface HarvestLot {
  id: string;
  crop_name: string;
  cluster_id: string | null;
  total_quantity_kg: number;
  quality_grade: string;
  harvest_date: string | null;
  location: string;
  price_per_kg: number;
  status: string;
  created_by: string;
}

export interface HarvestContribution {
  id: string;
  lot_id: string;
  harvest_id: string | null;
  user_id: string;
  quantity_kg: number;
  quality_grade: string;
}

export interface CollectionCenter {
  id: string;
  name: string;
  village_id: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  opening_hours: string;
  capacity_kg: number;
  contact_phone: string;
}

export interface CollectionSlot {
  id: string;
  center_id: string;
  user_id: string;
  slot_date: string;
  slot_time: string;
  crop_name: string;
  quantity_kg: number;
  status: string;
}

export interface QualityAssessment {
  id: string;
  contribution_id: string | null;
  lot_id: string | null;
  assessed_by: string;
  moisture_pct: number;
  cleanliness_pct: number;
  defects_pct: number;
  grade: string;
  ai_observations: string;
  human_verified: boolean;
  score: number;
}

export interface BuyerRequirement {
  id: string;
  buyer_id: string;
  crop_name: string;
  quantity_kg: number;
  max_price_per_kg: number;
  quality_grade: string;
  delivery_date: string | null;
  delivery_location: string;
  notes: string;
  status: string;
  created_at: string;
}

export interface BuyerOffer {
  id: string;
  buyer_id: string;
  requirement_id: string | null;
  lot_id: string | null;
  price_per_kg: number;
  quantity_kg: number;
  notes: string;
  status: string;
  created_at: string;
}

export interface BuyerOrder {
  id: string;
  buyer_id: string;
  farmer_id: string | null;
  lot_id: string | null;
  offer_id: string | null;
  crop_name: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  status: string;
  delivery_date: string | null;
  delivery_location: string;
  notes: string;
  created_at: string;
}

export interface FarmExpense {
  id: string;
  user_id: string;
  farm_id: string | null;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
}

export interface FarmProduction {
  id: string;
  user_id: string;
  farm_id: string | null;
  crop_name: string;
  quantity_kg: number;
  production_date: string;
  notes: string;
}

export interface FarmSale {
  id: string;
  user_id: string;
  crop_name: string;
  quantity_kg: number;
  price_per_kg: number;
  total_amount: number;
  buyer_name: string;
  sale_date: string;
}

export interface RewardTransaction {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  type: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  description: string;
  village_id: string | null;
  cluster_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  type: string;
  content: string;
  image_url: string;
  is_pinned: boolean;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  language: string;
  created_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface AIAnalysis {
  id: string;
  user_id: string;
  image_url: string;
  crop: string;
  issue: string;
  all_problems: string;
  disease_type: string;
  severity: string;
  confidence: number;
  symptoms: string;
  affected_parts: string;
  suggested_actions: string;
  organic_treatment: string;
  chemical_treatment: string;
  fertilizer_name: string;
  fertilizer_type: string;
  fertilizer_quantity: string;
  fertilizer_frequency: string;
  fertilizer_application: string;
  prevention: string;
  treatment_timeline: string;
  estimated_impact: string;
  advisory_note: string;
  created_at: string;
}

export interface WeatherAlert {
  id: string;
  village_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  alert_date: string;
}

export interface MarketPrice {
  id: string;
  crop_name: string;
  price_per_kg: number;
  market: string;
  recorded_date: string;
  is_demo: boolean;
  state: string;
  district: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LivePrice {
  crop_name: string;
  price_per_kg: number;
  market: string;
  state: string;
  district: string;
  trend: string;
  change_percent: number;
  source: string;
  min_price: number;
  max_price: number;
  arrival_date: string;
}

export interface PricePrediction {
  id: string;
  crop_name: string;
  current_price: number;
  predicted_price: number;
  trend: string;
  horizon_days: number;
  confidence: number;
  reasoning: string;
  advisory_note: string;
}

export interface Complaint {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  resolution: string;
  created_at: string;
}


