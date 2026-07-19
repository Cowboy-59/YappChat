import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ycSchema } from "./schema-base";

/**
 * Spec 009 — push notification tokens. One row per registered device push token
 * (Expo push token). A message-send fans out a push to each recipient's tokens so
 * they're notified even when the app is closed. `userid` is the owning user (FK-less
 * to users, per the engine-schema convention). `token` is globally unique — the same
 * device re-registering upserts the row (and re-owns it if the signed-in user changed).
 */
export const pushtokens = ycSchema.table(
  "pushtokens",
  {
    id: uuid("id").primaryKey(),
    userid: uuid("userid").notNull(),
    token: text("token").notNull(), // Expo push token, e.g. ExponentPushToken[xxx]
    platform: text("platform").notNull(), // ios | android
    deviceid: text("deviceid"), // optional client-generated device id
    createdat: timestamp("createdat", { withTimezone: true }).notNull().defaultNow(),
    updatedat: timestamp("updatedat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pushtokens_token_key").on(t.token), index("pushtokens_userid_idx").on(t.userid)],
);

export type PushTokenRow = typeof pushtokens.$inferSelect;
