// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const operators = sqliteTable('operators', {
  slot: integer('slot').primaryKey(), userId: text('user_id').notNull().unique(),
  email: text('email').notNull(), createdAt: integer('created_at').notNull(),
});
export const albums = sqliteTable('albums', {
  id: text('id').primaryKey(), data: text('data').notNull(),
  published: integer('published').notNull().default(0), updatedAt: integer('updated_at').notNull(),
});
export const media = sqliteTable('media', {
  id: text('id').primaryKey(), albumId: text('album_id').notNull().references(() => albums.id, {onDelete:'cascade'}),
  key: text('key').notNull(), kind: text('kind').notNull(), mime: text('mime').notNull(),
  caption: text('caption').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('idx_media_album_created').on(t.albumId, t.createdAt)]);
