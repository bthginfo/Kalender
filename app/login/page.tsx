import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Anmelden · Kalender" };

export default function LoginPage() {
  return (
    <main style={{ position: "relative", zIndex: 1, minHeight: "100dvh", display: "grid", placeItems: "center", padding: "env(safe-area-inset-top) 16px env(safe-area-inset-bottom)" }}>
      <LoginForm />
    </main>
  );
}
