"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { getFirstAccessibleRoute } from "@/lib/permissions";
import { Center, Loader } from "@mantine/core";

export default function Home() {
  const router = useRouter();
  const { token, user, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) { router.replace("/login"); return; }

    if (user?.role === "super_admin" || user?.role === "company_admin") {
      router.replace("/dashboard");
    } else {
      router.replace(getFirstAccessibleRoute(user?.permissions ?? []));
    }
  }, [_hasHydrated, token, user, router]);

  return (
    <Center style={{ height: "100vh", background: "#f8fafc" }}>
      <Loader size="md" color="blue" />
    </Center>
  );
}
