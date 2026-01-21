# Groq AI Integration Setup

This document explains how the AI conversation feature works with Groq AI.

## Overview

The AI conversation system uses [Groq](https://groq.com) for fast LLM inference with the LLaMA 3.1 model. The architecture follows this flow:

1. **User sends message** → Frontend (ConversationSidebar)
2. **API route creates messages** → `/api/messages` (Creates user + assistant placeholder)
3. **Inngest triggers background job** → Processes the message asynchronously
4. **Convex mutation calls Groq** → Gets AI response and updates database
5. **Real-time update** → User sees the response via Convex subscriptions

## Setup Instructions

### 1. Get Your Groq API Key

1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key

### 2. Configure Environment Variables

Add to your `.env.local` file:

```bash
# Groq AI
GROQ_API_KEY=your_groq_api_key_here

# Convex Internal Key (generate a secure random string)
DEVFLOW_CONVEX_INTERNAL_KEY=your_secure_random_key_here
```

The `DEVFLOW_CONVEX_INTERNAL_KEY` is used to secure internal API calls between your Next.js app and Convex mutations.

### 3. Deploy to Convex

Since Convex needs the environment variable, set it in your Convex deployment:

```bash
npx convex env set GROQ_API_KEY your_groq_api_key_here
npx convex env set DEVFLOW_CONVEX_INTERNAL_KEY your_secure_random_key_here
```

## Architecture

### Files Involved

- **`convex/system.ts`** - Contains the Groq AI integration and message processing logic
- **`src/app/api/messages/route.ts`** - API endpoint that receives user messages
- **`src/features/conversations/inngest/process-message.ts`** - Background job handler
- **`src/features/conversations/components/conversation-sidebar.tsx`** - UI component
- **`convex/conversations.ts`** - Database queries for conversations and messages

### Data Flow

```
User Input
    ↓
ConversationSidebar (React Component)
    ↓
POST /api/messages
    ↓
Create user message in Convex
    ↓
Create assistant placeholder message (status: "processing")
    ↓
Trigger Inngest event "message/sent"
    ↓
processMessage (Inngest Function)
    ↓
system.processMessage (Convex Mutation)
    ↓
Groq API Call (llama-3.1-8b-instant)
    ↓
Update assistant message with response
    ↓
Real-time update to UI via Convex subscription
```

## Key Features

### 1. Conversation History

The system maintains conversation history and sends the last 10 messages to Groq for context.

### 2. Conversation Summary

Each conversation has a summary field that gets updated with each response, helping the AI maintain context across longer conversations.

### 3. Processing Status

Messages have a `status` field:
- `processing` - AI is generating a response
- `completed` - Response is ready
- `cancelled` - Message was cancelled

### 4. Error Handling

If the Inngest job fails, the `onFailure` handler automatically updates the message with a friendly error message.

### 5. JSON Response Parsing

The AI is prompted to respond in JSON format with:
```json
{
  "reply": "The AI's response",
  "summary": "Brief conversation summary"
}
```

If parsing fails, the raw response is used as the reply.

## Model Configuration

The current configuration in `convex/system.ts`:

```typescript
const response = await groq.chat.completions.create({
  model: "llama-3.1-8b-instant",  // Fast, cost-effective model
  temperature: 0.7,                 // Balanced creativity
  messages: [...],                  // Conversation history
});
```

### Available Models

You can change the model by updating the `model` parameter. Popular Groq models:

- `llama-3.1-8b-instant` - Fast, good for general use (current)
- `llama-3.1-70b-versatile` - More powerful, better reasoning
- `mixtral-8x7b-32768` - Long context window (32k tokens)
- `gemma2-9b-it` - Google's Gemma model

See [Groq Models Documentation](https://console.groq.com/docs/models) for the full list.

## Testing

1. Start your development server: `npm run dev`
2. Open a project in DevFlow
3. Click the chat icon to open the conversation sidebar
4. Type a message and press Enter
5. You should see "Thinking..." followed by the AI response

## Troubleshooting

### "GROQ_API_KEY is not configured"

Make sure you've set the environment variable in both:
- Local: `.env.local`
- Convex: `npx convex env set GROQ_API_KEY your_key`

### "Invalid internal key"

Ensure `DEVFLOW_CONVEX_INTERNAL_KEY` is the same in both:
- `.env.local`
- Convex environment variables

### Messages stuck in "processing"

Check:
1. Inngest is running (the `/api/inngest` endpoint is accessible)
2. Your Groq API key is valid
3. Check the Inngest dashboard for failed jobs
4. Check Convex logs for errors

### Rate Limiting

Groq has rate limits on the free tier. If you hit limits:
- Upgrade your Groq plan
- Add retry logic
- Implement request queuing

## Customization

### Change System Prompt

Edit the system message in `convex/system.ts`:

```typescript
{
  role: "system",
  content: `Your custom system prompt here...`
}
```

### Adjust Temperature

Lower temperature (0.1-0.4) for more focused responses, higher (0.8-1.0) for more creative responses.

### Modify Context Length

Change the `.take(10)` in `system.ts` to include more or fewer messages in context:

```typescript
.take(20)  // Include last 20 messages
```

## Security Notes

- Never commit your `.env.local` file
- Keep your `DEVFLOW_CONVEX_INTERNAL_KEY` secret and random
- Rotate API keys periodically
- Monitor usage in the Groq console

## Next Steps

- Add streaming responses for better UX
- Implement message cancellation
- Add file attachments support
- Integrate code context from the editor
- Add conversation search and filtering
