import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),

  title: text("title").notNull().default("Untitled"),

  content: jsonb("content").notNull(),

  revision: integer("revision").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  deletedAt: timestamp("deleted_at"),
});
