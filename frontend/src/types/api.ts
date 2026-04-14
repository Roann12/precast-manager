// File overview: Shared TypeScript types for API and frontend models in types/api.ts.
// Backend-aligned API types (FastAPI + SQLAlchemy models)

export type ISODateString = string; // YYYY-MM-DD
export type ISODateTimeString = string; // ISO 8601

// -------------------------
// Core models (SQLAlchemy)
// -------------------------

export interface Project {
  id: number;
  project_name: string;
  client: string | null;
  start_date: ISODateString | null;
  due_date: ISODateString | null;
  status: string;
  status_reason: string | null;
  closed_at: ISODateString | null;
  work_saturday: boolean;
  work_sunday: boolean;
}

export interface ProjectCreate {
  project_name: string;
  client?: string | null;
  start_date?: ISODateString | null;
  due_date?: ISODateString | null;
  status?: string;
  status_reason?: string | null;
  closed_at?: ISODateString | null;
  work_saturday?: boolean;
  work_sunday?: boolean;
}

export interface ProjectUpdate {
  project_name?: string | null;
  client?: string | null;
  start_date?: ISODateString | null;
  due_date?: ISODateString | null;
  status?: string | null;
  status_reason?: string | null;
  closed_at?: ISODateString | null;
  work_saturday?: boolean | null;
  work_sunday?: boolean | null;
}

export interface Element {
  id: number;
  project_id: number;
  mix_design_id?: number | null;
  element_type: string;
  element_mark: string;
  quantity: number;
  volume: number | null;
  due_date: ISODateString | null;
  concrete_strength_mpa?: number | null;
  requires_cubes?: boolean;
  panel_length_mm?: number | null;
  slab_thickness_mm?: number | null;
  active?: boolean;
  status: string | null;
  allowed_mould_ids?: number[];
}

export interface ElementCreate {
  project_id: number;
  mix_design_id?: number | null;
  element_type: string;
  element_mark: string;
  quantity: number;
  volume?: number | null;
  due_date?: ISODateString | null;
  concrete_strength_mpa?: number | null;
  requires_cubes?: boolean;
  panel_length_mm?: number | null;
  slab_thickness_mm?: number | null;
  status?: string | null;
  allowed_mould_ids: number[];
}

export interface ElementUpdate {
  mix_design_id?: number | null;
  element_type?: string;
  element_mark?: string;
  quantity?: number;
  volume?: number | null;
  due_date?: ISODateString | null;
  concrete_strength_mpa?: number | null;
  requires_cubes?: boolean | null;
  panel_length_mm?: number | null;
  slab_thickness_mm?: number | null;
  active?: boolean | null;
  status?: string | null;
  allowed_mould_ids?: number[] | null;
}

export interface MixDesign {
  id: number;
  name: string;
  target_strength_mpa: number | null;
  active: boolean;
}

export interface MixDesignCreate {
  name: string;
  target_strength_mpa?: number | null;
  active?: boolean;
}

export interface MixDesignUpdate {
  name?: string | null;
  target_strength_mpa?: number | null;
  active?: boolean | null;
}

export interface Mould {
  id: number;
  name: string;
  mould_type: string;
  capacity: number;
  cycle_time_hours: number;
  active: boolean;
}

export interface MouldCreate {
  name: string;
  mould_type: string;
  capacity: number;
  cycle_time_hours: number;
  active?: boolean;
}

export interface MouldUpdate {
  name?: string | null;
  mould_type?: string | null;
  capacity?: number | null;
  cycle_time_hours?: number | null;
  active?: boolean | null;
}

export interface ProductionSchedule {
  id: number;
  element_id: number;
  mould_id: number;
  production_date: ISODateString;
  quantity: number;
  batch_id: string | null;
  status: string;
  created_at: ISODateTimeString;
}

export interface ProductionUpdate {
  mould_id?: number | null;
  production_date?: ISODateString | null;
  quantity?: number | null;
  status?: string | null;
}

export interface YardLocation {
  id: number;
  name: string;
  description: string | null;
}

export interface YardInventory {
  id: number;
  element_id: number | null;
  location_id: number | null;
  quantity: number;
}

export interface HollowcoreSettings {
  id?: number;
  bed_count: number;
  bed_length_mm: number;
  waste_margin_mm: number;
  casts_per_bed_per_day: number;
  active: boolean;
}

export interface HollowcoreCast {
  id: number;
  element_id: number;
  cast_date: ISODateString;
  bed_number: number;
  /** Present when API includes explicit bed FK (planner uses both bed_number and bed_id). */
  bed_id?: number | null;
  cast_slot_index: number;
  slab_thickness_mm: number;
  panel_length_mm: number;
  quantity: number;
  batch_id: string | null;
  status: string;
  created_at: ISODateTimeString;
}

export interface DispatchOrder {
  id: number;
  factory_id?: number | null;
  project_id: number | null;
  dispatch_date: ISODateString;
  truck_number: string | null;
  status: string | null;
  status_changed_at?: ISODateTimeString | null;
  status_changed_by?: number | null;
  status_changed_by_name?: string | null;
}

export interface DispatchItem {
  id: number;
  dispatch_id: number | null;
  yard_inventory_id: number | null;
  quantity: number;
}

export interface DispatchDetail {
  order: DispatchOrder;
  items: DispatchItem[];
}

// -------------------------
// Router-specific responses
// -------------------------

export interface DashboardCalendarItem {
  id: number;
  production_date: ISODateString;
  mould_id: number;
  mould: string;
  project_id: number;
  project_name: string;
  project_due_date: ISODateString | null;
  element_type: string;
  element_mark: string;
  element_due_date: ISODateString | null;
  requires_cubes: boolean;
  batch_id: string | null;
  quantity: number;
  status: string;
}

export interface ElementProgress {
  element_id: number;
  element_mark: string;
  planned_total: number;
  completed_qty: number;
  remaining_qty: number;
  derived_status: "planned" | "in_progress" | "completed";
}

export interface WetcastingActivityItem {
  id: number;
  created_at: ISODateTimeString;
  section: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  user_id: number;
  user_name: string | null;
}

export interface DashboardProductionItem {
  production_date: ISODateString;
  mould: string;
  element_type: string;
  quantity: number;
}

export interface DashboardMouldUtilizationItem {
  mould: string;
  capacity: number;
  scheduled: number;
  utilization_percent: number;
}

export interface DashboardYardStockItem {
  element_type: string;
  element_mark: string;
  location: string;
  quantity: number;
}

export interface DashboardOverview {
  today: ISODateString;
  todays_units: number;
  todays_schedules: number;
  todays_completed: number;
  late_scheduled_items: number;
  unscheduled_elements: number;
  hollowcore_late_elements: number;
  hollowcore_unscheduled_elements: number;
  /** Hollowcore elements where sum(committed casts) < order quantity (see Hollowcore planner). */
  hollowcore_unscheduled_detail?: Array<{
    element_id: number;
    element_mark: string;
    order_quantity: number;
    scheduled_quantity: number;
    remaining: number;
  }>;
  projects_at_risk: Array<{
    project_id: number;
    project_name: string;
    due_date: ISODateString;
    last_scheduled_date: ISODateString;
    days_late: number;
  }>;
  /** Present on API after dashboard metrics extension; treat as 0 if missing. */
  dispatch_orders_planned?: number;
  dispatch_orders_planned_with_items?: number;
  yard_inventory_lines?: number;
  hollowcore_planned_casts_today?: number;
  /** Lab cube schedule: batches past due for crush testing. */
  qc_lab_overdue?: number;
  /** Lab work due today. */
  qc_lab_due_today?: number;
  /** Lab work due tomorrow. */
  qc_lab_due_tomorrow?: number;
  /** Recorded tests with no pass/fail where test date is today or earlier (needs manual entry). */
  qc_manual_results_pending?: number;
}

export interface DashboardPlannedByTypeItem {
  label: string;
  value: number;
}

export interface DashboardCapacity {
  start: ISODateString;
  days: number;
  moulds: Array<{
    mould_id: number;
    mould: string;
    mould_type: string;
    cycle_time_hours: number;
    series: Array<{
      date: ISODateString;
      used: number;
      capacity: number;
      free: number;
      utilization_percent: number;
    }>;
  }>;
}

export interface YardInventoryRow {
  yard_inventory_id: number;
  location_id: number;
  element_id: number;
  project_id: number;
  project_name: string;
  location: string;
  element_mark: string;
  element_type: string;
  quantity: number;
}

