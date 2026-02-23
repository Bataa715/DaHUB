/**
 * Date utility functions for ClickHouse database
 */

/**
 * Convert Date to ClickHouse DateTime format (YYYY-MM-DD HH:MM:SS)
 */
export function toClickHouseDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Parse ClickHouse DateTime string to Date object
 */
export function fromClickHouseDateTime(dateStr: string): Date {
  return new Date(dateStr.replace(" ", "T") + "Z");
}

/**
 * Get current timestamp in ClickHouse format
 */
export function nowClickHouse(): string {
  return toClickHouseDateTime();
}
