import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createPost = mutation({
  args: {
    text: v.string(),
    image: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const postId = await ctx.db.insert("posts", {
      userId: identity.subject,
      text: args.text,
      image: args.image,
      createdAt: Date.now(),
    });

    return postId;
  },
});