import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  posts: defineTable({
    userId: v.string(),
    text: v.string(),
    image: v.optional(v.string()), // This will store the Convex file storageId
    createdAt: v.number(),
  }),
});