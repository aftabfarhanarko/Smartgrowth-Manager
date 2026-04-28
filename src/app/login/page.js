"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AlertCircle, LoaderCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json?.error || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Something went wrong. Please check your connection.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-stretch overflow-hidden bg-white">
      {/* Left Section: Visual / Branding (Hidden on mobile) wqef wefgwewe */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-indigo-600 p-12 lg:flex xl:w-3/5">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(79,70,229,0.8),rgba(30,27,75,0.95))]">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4)_0%,transparent_50%)]"></div>
          {/* Animated decorative circles */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute -bottom-20 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-3xl"
          />
        </div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            Smart Growth Manager<span className="font-light text-amber-400">|</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold leading-tight text-white xl:text-5xl"
          >
            Empower your growth with data-driven insights.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-lg text-indigo-100/80"
          >
            Join thousands of smart managers using our delivery platform to optimize their workflow and scale their business.
          </motion.p>
        </div>

        <div className="relative z-10 flex items-center gap-6">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-10 rounded-full border-2 border-indigo-600 bg-indigo-100 ring-2 ring-indigo-600/20" />
            ))}
          </div>
          <p className="text-sm font-medium text-indigo-100">
            Trusted by <span className="font-bold text-white">2,000+</span> teams globally
          </p>
        </div>
      </div>

      {/* Right Section: Login Form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2 xl:w-2/5">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo for mobile */}
          <div className="mb-10 lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              Smart Growth Manager<span className="font-light text-amber-500">|</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-2 text-slate-500">Please enter your details to sign in.</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <Link href="/forgot-password" size="sm" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              <label htmlFor="remember" className="ml-2 block text-sm text-slate-600">
                Remember me for 30 days
              </label>
            </div>

            <button
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-indigo-200 disabled:bg-indigo-400"
              type="submit"
              disabled={loading}
            >
              <span className="relative z-10 flex items-center gap-2">
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </span>
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm font-medium">
              <span className="bg-white px-4 text-slate-500 uppercase tracking-wider text-[10px]">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              Facebook
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-indigo-600 hover:text-indigo-500">
              Create an account
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
