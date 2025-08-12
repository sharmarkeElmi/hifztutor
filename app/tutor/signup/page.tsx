"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Define a schema for form validation using Zod
const schema = z.object({
  full_name: z.string().min(2, { message: "Full name is required" }),
  email: z.string().email({ message: "Please enter a valid email" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

// Infer the form values type from the schema
type Values = z.infer<typeof schema>;

export default function TutorSignUpPage() {
  const router = useRouter();
  // State to track loading status during form submission
  const [loading, setLoading] = useState(false);
  // State to store any error message from signup process
  const [error, setError] = useState<string | null>(null);

  // Initialize react-hook-form with validation resolver and default values
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  // Handler function called when form is submitted
  const onSubmit = async (values: Values) => {
    setLoading(true); // Indicate loading state
    setError(null);   // Clear previous errors

    // Attempt to sign up the user with Supabase auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    // If there is an error during signup, display it and stop
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If signup is successful and user data is returned
    if (data?.user) {
      // Insert or update the tutor profile in the 'profiles' table
      // This ensures the tutor has a profile with the role set to 'tutor'
      await supabase.from("profiles").upsert({
        id: data.user.id,           // Use the user's unique ID
        full_name: values.full_name, // Store the full name from the form
        role: "tutor",              // Set the role explicitly as 'tutor'
      });
    }

    setLoading(false);    // Reset loading state
    router.push("/tutor/signin"); // Redirect the user to the tutor sign-in page
  };

  return (
    <section className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Tutor — Sign up</h1>

      {/* Form for tutor signup */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name input field */}
        <div>
          <label className="block text-sm font-medium" htmlFor="full_name">Full Name</label>
          <input
            id="full_name"
            type="text"
            {...register("full_name")}
            className="w-full p-2 border rounded"
            placeholder="Your full name"
          />
          {/* Display validation error for full name */}
          {errors.full_name && <p className="text-red-500 text-sm">{errors.full_name.message}</p>}
        </div>

        {/* Email input field */}
        <div>
          <label className="block text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            {...register("email")}
            className="w-full p-2 border rounded"
            placeholder="you@example.com"
          />
          {/* Display validation error for email */}
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
        </div>

        {/* Password input field */}
        <div>
          <label className="block text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            {...register("password")}
            className="w-full p-2 border rounded"
            placeholder="••••••••"
          />
          {/* Display validation error for password */}
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
        </div>

        {/* Display any signup error messages */}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Submit button, disabled while loading */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>

      {/* Link to tutor sign-in page */}
      <div className="text-center text-sm">
        Already have a tutor account?{" "}
        <Link href="/tutor/signin" className="text-blue-600 hover:underline">Sign in</Link>
      </div>

      {/* Link to student sign-up page */}
      <div className="text-center text-xs text-muted-foreground">
        Are you a student?{" "}
        <Link href="/signup" className="text-blue-600 hover:underline">Student sign up</Link>
      </div>
    </section>
  );
}