import { v } from "convex/values";

import { mutation, query, action } from "./_generated/server";
import { verifyAuth } from "./auth";

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      ownerId: identity.subject,
      updatedAt: Date.now(),
    });

    return projectId;
  },
});

export const getPartial = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .take(args.limit);
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx);

    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: {
    id: v.id("projects")
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.id);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized access to this project");
    }

    return project;
  },
});



export const getByGithub = action({
  args: {
    githubToken: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      throw new Error("You must be signed in to import a project.");
    }

    // Fetch repos using the provided token
    const res = await fetch("https://api.github.com/user/repos?per_page=100", {
      headers: {
        Authorization: `Bearer ${args.githubToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.statusText}`);
    }

    const repos = await res.json();
    return repos;
  },
});

export const rename = mutation({
  args: {
    id: v.id("projects"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get("projects", args.id);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized access to this project");
    }

    await ctx.db.patch("projects", args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});