// File overview: Activity feed formatting and transformation helpers for activity/wetcastingActivityFormat.ts.
import type { WetcastingActivityItem } from "../types/api";

// Inputs: caller state/arguments related to pretty action.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const prettyAction = (action: string) =>
  action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Inputs: caller state/arguments related to pretty entity type.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const prettyEntityType = (t: string | null | undefined) => {
  const v = (t ?? "").toLowerCase().trim();
  if (!v) return "—";
  if (v === "schedule") return "Production schedule";
  if (v === "planner_run") return "Planner run";
  if (v === "delay") return "Delay";
  if (v === "element") return "Element";
  if (v === "dispatch_order") return "Dispatch order";
  if (v === "yard_inventory") return "Yard inventory";
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const prettyFieldName = (f: string) => f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Formats activity details for display.
export function formatActivityDetails(
  it: WetcastingActivityItem,
  yardLocationNameById: Record<number, string> = {}
): string {
  const d: Record<string, unknown> | null =
    it.details && typeof it.details === "object" ? (it.details as Record<string, unknown>) : null;
  if (!d) return "—";

  if (it.action === "planner_commit") {
    if (d.inserted != null || d.updated != null || d.deleted != null) {
      const parts = [`Ins ${d.inserted ?? 0}`, `Upd ${d.updated ?? 0}`, `Del ${d.deleted ?? 0}`];
      if (d.cast_count != null) parts.push(`Casts ${d.cast_count}`);
      return parts.join(" • ");
    }
  }

  if (it.action === "dispatch_status" && d.to_status != null) {
    return `Status → ${String(d.to_status)}`;
  }

  if (it.action === "move_inventory" && (d.to_location_id != null || d.moved_quantity != null)) {
    const toId = d.to_location_id != null ? Number(d.to_location_id) : null;
    const loc =
      toId != null && yardLocationNameById[toId] ? yardLocationNameById[toId] : toId != null ? `#${toId}` : "—";
    const qty = d.moved_quantity != null ? `Qty ${d.moved_quantity}` : "";
    return [qty, `To ${loc}`].filter(Boolean).join(" • ");
  }

  if (typeof d.location_id === "number" || typeof d.location_id === "string") {
    const id = Number(d.location_id);
    const name = yardLocationNameById[id];
    const elementPart = d.element_mark ? `Element ${String(d.element_mark)} • ` : "";
    return `${elementPart}Moved to yard location: ${name ?? `#${id}`}`;
  }

  if (Array.isArray(d.updated_fields)) {
    const fields = (d.updated_fields as unknown[])
      .map((x) => String(x))
      .filter(Boolean)
      .map(prettyFieldName);
    const elementPart = d.element_mark ? `Element ${String(d.element_mark)} • ` : "";
    return `${elementPart}${fields.length ? `Updated: ${fields.join(", ")}` : "Updated schedule"}`;
  }

  if (d.scheduled_batches != null || d.unscheduled_count != null) {
    const parts: string[] = [];
    if (d.scheduled_batches != null) parts.push(`Scheduled: ${String(d.scheduled_batches)}`);
    if (d.unscheduled_count != null) parts.push(`Unscheduled: ${String(d.unscheduled_count)}`);
    return parts.join(" • ") || "—";
  }

  if (d.element_mark) {
    const extras = Object.entries(d)
      .filter(([k]) => !["element_mark"].includes(k))
      .map(([k, v]) => `${prettyFieldName(k)}: ${String(v)}`);
    return extras.length ? `${String(d.element_mark)} • ${extras.join(" • ")}` : String(d.element_mark);
  }

  try {
    return JSON.stringify(d);
  } catch {
    return "—";
  }
}

// Formats activity entity label for display.
export function formatActivityEntityLabel(it: WetcastingActivityItem): string {
  const details = it.details as Record<string, unknown> | null | undefined;
  const mark =
    details && typeof details === "object" && details.element_mark != null
      ? String(details.element_mark)
      : null;
  const base = prettyEntityType(it.entity_type);
  const withId = it.entity_id != null ? `${base} #${it.entity_id}` : base;
  return mark ? `${withId} (${mark})` : withId;
}
