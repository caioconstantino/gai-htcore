"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Box, Burger, Drawer, Group, Text, ThemeIcon, Loader, Center } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconBolt } from "@tabler/icons-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, _hasHydrated } = useAuthStore();
  const [drawerOpened, { open, close }] = useDisclosure(false);
  const isMobile = useMediaQuery("(max-width: 768px)") ?? false;

  useEffect(() => {
    // Only redirect after the store has rehydrated from localStorage.
    // Without this guard, the first render sees token=null and redirects
    // to /login even when the user is actually logged in.
    if (_hasHydrated && !token) {
      router.push("/login");
    }
  }, [_hasHydrated, token, router]);

  // Show a loading screen while rehydrating to avoid flash of /login
  if (!_hasHydrated) {
    return (
      <Center style={{ height: "100vh", background: "#f8fafc" }}>
        <Loader size="md" color="blue" />
      </Center>
    );
  }

  if (!token) return null;

  return (
    <Box style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Desktop sidebar — always visible */}
      {!isMobile && <Sidebar />}

      {/* Mobile sidebar — drawer overlay */}
      {isMobile && (
        <Drawer
          opened={drawerOpened}
          onClose={close}
          size={240}
          padding={0}
          withCloseButton={false}
          styles={{
            body: { padding: 0, height: "100%", background: "#0f172a" },
            content: { background: "#0f172a" },
          }}
        >
          <Sidebar onNavigate={close} />
        </Drawer>
      )}

      {/* Main content */}
      <Box component="main" style={{ flex: 1, overflowY: "auto", background: "#f8fafc", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile top bar */}
        {isMobile && (
          <Box
            style={{
              padding: "0 16px",
              height: 52,
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <Burger opened={drawerOpened} onClick={open} color="white" size="sm" />
            <Group gap={8}>
              <ThemeIcon size={28} radius="md" color="blue" variant="filled">
                <IconBolt size={14} />
              </ThemeIcon>
              <Text fw={700} c="white" size="sm">G.AI</Text>
            </Group>
          </Box>
        )}

        <Box style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 12px" : 24 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
