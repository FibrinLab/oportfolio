import { integer, timestamp, uuid } from "drizzle-orm/pg-core";

// spec/05: all mutable tables include created_at, created_by, updated_at,
// updated_by, row_version. Timestamps are UTC (timestamptz).
export const mutableColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
  rowVersion: integer("row_version").notNull().default(1),
};
