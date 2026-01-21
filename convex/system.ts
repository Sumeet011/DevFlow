import { v } from "convex/values";

import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import Groq from "groq-sdk";

const validateInternalKey = (key: string) => {
  const internalKey = process.env.DEVFLOW_CONVEX_INTERNAL_KEY;

  if (!internalKey) {
    throw new Error("DEVFLOW_CONVEX_INTERNAL_KEY is not configured");
  }
  console.log("Validating internal key:", process.env.DEVFLOW_CONVEX_INTERNAL_KEY, key);

  if (key !== internalKey) {
    throw new Error("Invalid internal key");
  }
};

export const getConversationById = query({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db.get(args.conversationId);
  },
});

export const getMessageById = query({
  args: {
    messageId: v.id("messages"),
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db.get(args.messageId);
  },
});

export const getMessagesByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    internalKey: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const createMessage = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      projectId: args.projectId,
      role: args.role,
      content: args.content,
      status: args.status,
    });

    // Update conversation's updatedAt
    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const processMessage = action({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    // Initialize Groq client inside the action
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const message = await ctx.runQuery(api.system.getMessageById, {
      messageId: args.messageId,
      internalKey: args.internalKey,
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const conversation = await ctx.runQuery(api.system.getConversationById, {
      conversationId: message.conversationId,
      internalKey: args.internalKey,
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Get conversation history
    const messages = await ctx.runQuery(api.system.getMessagesByConversation, {
      conversationId: message.conversationId,
      internalKey: args.internalKey,
    });

    // Filter out the current assistant message (which is empty) and take last 10
    const historyMessages = messages
      .filter((m) => m._id !== args.messageId)
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const summary = conversation.summary;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are an AI coding assistant embedded in a developer IDE called DevFlow.
Reply in JSON format only with the following fields:
{
  "reply": "<Your helpful reply to the user's message>",
  "summary": "<A brief summary of the conversation so far>"
}

Previous summary:
${summary ?? "No previous summary available."}
          `.trim(),
        },
        ...historyMessages,
      ] as any,
    });

    // Store The AI's response and update summary and status
    const aiResponse = response.choices[0]?.message?.content || "";
    
    let parsedResponse: { reply: string; summary?: string };
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      // If JSON parsing fails, use raw response
      parsedResponse = { reply: aiResponse };
    }

    // Update the message content via mutation
    await ctx.runMutation(api.system.updateMessageContent, {
      internalKey: args.internalKey,
      messageId: args.messageId,
      content: parsedResponse.reply,
    });

    // Update conversation summary if provided
    if (parsedResponse.summary) {
      await ctx.runMutation(api.system.updateConversationSummary, {
        internalKey: args.internalKey,
        conversationId: message.conversationId,
        summary: parsedResponse.summary,
      });
    }

    return {
      content: parsedResponse.reply,
      summary: parsedResponse.summary,
    };
  },
});


export const updateMessageContent = mutation({
  args: {
    internalKey: v.string(),
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "completed" as const,
    });
  },
});

export const updateConversationSummary = mutation({
  args: {
    internalKey: v.string(),
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    validateInternalKey(args.internalKey);

    await ctx.db.patch(args.conversationId, {
      summary: args.summary,
      updatedAt: Date.now(),
    });
  },
});