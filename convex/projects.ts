import { v } from "convex/values";

import { mutation, query, action, internalMutation, internalAction } from "./_generated/server";
import { verifyAuth } from "./auth";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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

// Internal version for GitHub import
export const createInternal = internalMutation({
  args: {
    name: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      ownerId: args.ownerId,
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

    if (!args.githubToken) {
      throw new Error("GitHub token is required");
    }


   
    try {
      // First, validate the token by checking user info
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${args.githubToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!userRes.ok) {
        console.error("getByGithub: User validation failed:", userRes.status, userRes.statusText);
        if (userRes.status === 401) {
          throw new Error("GitHub token is invalid or expired. Please reconnect your GitHub account.");
        }
        throw new Error(`GitHub API error: ${userRes.status} ${userRes.statusText}`);
      }

      const userData = await userRes.json();

      // Fetch repos using the provided token
      const reposRes = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: {
          Authorization: `Bearer ${args.githubToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!reposRes.ok) {
        console.error("getByGithub: Repos fetch failed:", reposRes.status, reposRes.statusText);
        if (reposRes.status === 401) {
          throw new Error("GitHub token is invalid or expired. Please reconnect your GitHub account.");
        }
        throw new Error(`Failed to fetch repositories: ${reposRes.status} ${reposRes.statusText}`);
      }

      const repos = await reposRes.json();

      // Filter out repos the user can't access or are empty
      const accessibleRepos = repos.filter((repo: any) => {
        const hasPullPermission = repo.permissions?.pull !== false;
        const hasSize = repo.size > 0;
        const isAccessible = hasPullPermission && hasSize;
        return isAccessible;
      });

      // If no repos pass the filter, return some repos anyway for debugging
      if (accessibleRepos.length === 0 && repos.length > 0) {
        return repos.slice(0, 5).map((repo: any) => ({
          ...repo,
          debug_info: `pull: ${repo.permissions?.pull}, size: ${repo.size}`
        }));
      }

      return accessibleRepos;
    } catch (error) {
      console.error("Error in getByGithub:", error);
      throw error;
    }
  },
});




export const importFromGithub = action({
  args: {
    githubToken: v.string(),
    projectimportId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"projects">> => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("You must be signed in to import a project.");
    }

    const headers = {
      Authorization: `Bearer ${args.githubToken}`,
      Accept: "application/vnd.github+json",
    };

    // 1️⃣ Fetch repo metadata
    const repoRes = await fetch(
      `https://api.github.com/repos/${args.projectimportId}`,
      { headers }
    );

    if (!repoRes.ok) {
      throw new Error("Failed to fetch repository");
    }
    const repo = await repoRes.json();

    // 2️⃣ Create project immediately (optimistic)
    const projectId: Id<"projects"> = await ctx.runMutation(internal.projects.createInternal, {
      name: repo.name,
      ownerId: identity.subject,
    });

    // Update status to importing
    await ctx.runMutation(internal.projects.updateImportStatus, {
      id: projectId,
      status: "importing",
    });

    try {
      // 3️⃣ Fetch full file tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${args.projectimportId}/git/trees/${repo.default_branch}?recursive=1`,
        { headers }
      );

      if (!treeRes.ok) throw new Error("Failed to fetch file tree");

      const tree = await treeRes.json();

      // 4️⃣ Build folder hierarchy and file list
      const pathToIdMap = new Map<string, Id<"files">>();
      const folders: Array<{ path: string; name: string; parentPath: string }> = [];
      const files: Array<{ path: string; name: string; parentPath: string; url: string; size: number }> = [];

      // Separate folders and files
      for (const node of tree.tree) {
        const pathParts = node.path.split("/");
        const name = pathParts[pathParts.length - 1];
        const parentPath = pathParts.slice(0, -1).join("/");

        if (node.type === "tree") {
          folders.push({ path: node.path, name, parentPath });
        } else if (node.type === "blob") {
          files.push({ 
            path: node.path, 
            name, 
            parentPath, 
            url: node.url,
            size: node.size 
          });
        }
      }

      // Sort folders by depth (parents first)
      folders.sort((a, b) => {
        const depthA = a.path.split("/").length;
        const depthB = b.path.split("/").length;
        return depthA - depthB;
      });

      // 5️⃣ Insert folders first (so we have parentIds)
      for (const folder of folders) {
        const parentId = folder.parentPath ? pathToIdMap.get(folder.parentPath) : undefined;
        
        const folderId = await ctx.runMutation(internal.files.createFolderInternal, {
          projectId,
          parentId,
          name: folder.name,
        });
        
        pathToIdMap.set(folder.path, folderId);
      }

      // 6️⃣ Batch insert files (structure only, no content yet)
      const fileInsertions: Array<{
        parentId: Id<"files"> | undefined;
        name: string;
        path: string;
        url: string;
        size: number;
      }> = [];

      for (const file of files) {
        const parentId = file.parentPath ? pathToIdMap.get(file.parentPath) : undefined;
        fileInsertions.push({
          parentId,
          name: file.name,
          path: file.path,
          url: file.url,
          size: file.size,
        });
      }

      // Insert files in batches of 10 (with content fetching)
      const BATCH_SIZE = 10;
      for (let i = 0; i < fileInsertions.length; i += BATCH_SIZE) {
        const batch = fileInsertions.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (file) => {
            let content = "";
            
            // Fetch content for small files immediately
            if (file.size < 100_000 && file.size > 0) {
              try {
                
                // Use the contents API instead of blob URL for more reliable fetching
                const contentsUrl = `https://api.github.com/repos/${args.projectimportId}/contents/${file.path}`;
                const contentRes = await fetch(contentsUrl, { headers });
                
                if (!contentRes.ok) {
                  //console.error(`Failed to fetch content for ${file.path}: ${contentRes.status} ${contentRes.statusText}`);
                } else {
                  const contentData = await contentRes.json();
                  
                  if (contentData.content && contentData.encoding === "base64") {
                    // Use atob instead of Buffer (which isn't available in Convex)
                    const base64Content = contentData.content.replace(/\n/g, "");
                    content = atob(base64Content);
                  } else if (contentData.content) {
                    content = contentData.content;
                  } else {
                    //console.warn(`No content in response for ${file.path}`);
                  }
                }
              } catch (error) {
              }
            } 
            
            const fileId = await ctx.runMutation(internal.files.createFileInternal, {
              projectId,
              parentId: file.parentId,
              name: file.name,
              content,
            });
            pathToIdMap.set(file.path, fileId);
          })
        );
      }

      // 7️⃣ Mark as completed
      await ctx.runMutation(internal.projects.updateImportStatus, {
        id: projectId,
        status: "completed",
      });

      return projectId;
    } catch (error) {
      // Mark as failed
      await ctx.runMutation(internal.projects.updateImportStatus, {
        id: projectId,
        status: "failed",
      });
      throw error;
    }
  },
});

// Background job to fetch file contents
export const fetchFileContents = internalAction({
  args: {
    projectId: v.id("projects"),
    files: v.array(
      v.object({
        id: v.id("files"),
        url: v.string(),
      })
    ),
    githubToken: v.string(),
  },
  handler: async (ctx, args) => {
    const headers = {
      Authorization: `Bearer ${args.githubToken}`,
      Accept: "application/vnd.github+json",
    };

    // Process files in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < args.files.length; i += BATCH_SIZE) {
      const batch = args.files.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          try {
            const blobRes = await fetch(file.url, { headers });
            if (!blobRes.ok) return; // Skip if failed

            const blob = await blobRes.json();
            const content = Buffer.from(blob.content, "base64").toString("utf8");

            await ctx.runMutation(internal.files.updateFileContent, {
              id: file.id,
              content,
            });
          } catch (error) {
            //console.error(`Failed to fetch content for file ${file.id}:`, error);
            // Continue with other files
          }
        })
      );
    }
  },
});

export const updateImportStatus = internalMutation({
  args: {
    id: v.id("projects"),
    status: v.union(
      v.literal("importing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      importStatus: args.status,
      updatedAt: Date.now(),
    });
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

export const deleteProject = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const project = await ctx.db.get(args.id);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== identity.subject) {
      throw new Error("Unauthorized access to this project");
    }

    // Delete all files in the project
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const file of files) {
      await ctx.db.delete(file._id);
    }

    // Delete all conversations in the project
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const conversation of conversations) {
      // Delete messages in each conversation
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      await ctx.db.delete(conversation._id);
    }

    // Finally, delete the project
    await ctx.db.delete(args.id);
  },
});
