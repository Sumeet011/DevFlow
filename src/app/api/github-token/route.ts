import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clerk = await clerkClient();
    const tokens = await clerk.users.getUserOauthAccessToken(
      userId,
      "oauth_github"
    );

    if (!tokens || tokens.data.length === 0) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 403 }
      );
    }

    const githubAccessToken = tokens.data[0].token;

    return NextResponse.json({ token: githubAccessToken });
  } catch (error) {
    console.error("Error fetching GitHub token:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub token" },
      { status: 500 }
    );
  }
}
