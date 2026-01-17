import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, User, Mail } from "lucide-react";
import { useSignIn, SignUp, useSignUp, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";

const UnAuthenticatedView = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const steps = [
    { number: 1, label: "Sign up your account" },
    { number: 2, label: "Set up your workspace" },
    { number: 3, label: "Get Started With DevFlow" },
  ];

  if (!signInLoaded || !signUpLoaded) return null;

  const handleGoogle = async () => {
    if (!signUp) {
      console.error("SignUp not loaded");
      toast.error("Authentication not ready. Please refresh the page.");
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Starting Google auth...");
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (error: any) {
      console.error("Google auth error:", error);
      toast.error(error?.errors?.[0]?.message || error?.message || "Failed to sign in with Google. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGithub = async () => {
    if (!signUp) {
      console.error("SignUp not loaded");
      toast.error("Authentication not ready. Please refresh the page.");
      return;
    }
    
    try {
      setIsLoading(true);
      console.log("Starting GitHub auth...");
      
      await signUp.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
      
      console.log("GitHub auth redirect initiated");
    } catch (error: any) {
      console.error("GitHub auth error:", error);
      console.error("Error details:", error?.errors);
      toast.error(error?.errors?.[0]?.message || error?.message || "Failed to sign in with GitHub. Please try again.");
      setIsLoading(false);
    }
  };
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden">
        {/* Gradient blob */}
        <div className="absolute inset-0 gradient-blob" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-12">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded-full border-2 border-foreground" />
            <span className="text-foreground text-lg font-medium">
              Dev Flow
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-semibold text-foreground mb-3 text-center">
            Get Started with Us
          </h1>
          <p className="text-muted-foreground text-center mb-10 max-w-xs">
            Complete these easy steps to register your account.
          </p>

          {/* Steps */}
          <div className="space-y-4 w-full max-w-xs">
            {steps.map((step) => (
              <div
                key={step.number}
                className="flex items-center gap-4 bg-card/80 backdrop-blur-sm rounded-xl px-5 py-4 border border-border/50"
              >
                <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium">
                  {step.number}
                </div>
                <span className="text-foreground text-sm">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <h2 className="text-2xl font-semibold text-foreground text-center mb-2">
            {mode === "signup" ? "Sign Up Account" : "Sign In"}
          </h2>

          <p className="text-muted-foreground text-center mb-8 text-sm">
            {mode === "signup"
              ? "Enter your personal data to create your account."
              : "Welcome back! Please sign in."}
          </p>

          {/* Social Buttons */}

          <div className="flex gap-4 mb-6">
            
            <Button
              onClick={handleGithub}
              variant="social"
              size="full"
              className="flex-1"
              disabled={isLoading}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Github
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-sm">Or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form className="space-y-5">
            {/* Name Fields */}
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-foreground text-sm mb-2 block">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="eg. John" className="pl-11" />
                  </div>
                </div>

                <div>
                  <label className="text-foreground text-sm mb-2 block">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="eg. Francisco" className="pl-11" />
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-foreground text-sm mb-2 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="eg. johnfrans@gmail.com"
                  className="pl-11"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-foreground text-sm mb-2 block">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-muted-foreground text-xs mt-2">
                Must be at least 8 characters.
              </p>
            </div>

            {/* Submit */}
            <Button variant="signup" size="full" className="mt-6">
              {mode === "signup" ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center mt-6 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-foreground font-medium hover:underline"
            >
              {mode === "signup" ? "Log in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnAuthenticatedView;