"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SSOCallbackPage() {
  useEffect(() => {
    console.log("SSO Callback page mounted");
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-lg mb-2">Signing you in…</div>
        <AuthenticateWithRedirectCallback
          continueSignUpUrl="/"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}
