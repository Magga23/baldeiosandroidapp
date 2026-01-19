
import React from "react";
import FloatingTabBar from "@/components/FloatingTabBar";
import { Stack } from "expo-router";

export default function TabLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
        <Stack.Screen name="projects" options={{ headerShown: false }} />
        <Stack.Screen name="time-tracking" options={{ headerShown: false }} />
        <Stack.Screen name="shop" options={{ headerShown: false }} />
      </Stack>
      <FloatingTabBar
        tabs={[
          {
            name: "home",
            route: "/(tabs)/(home)",
            label: "Home",
            icon: "home",
          },
          {
            name: "projects",
            route: "/(tabs)/projects",
            label: "Projects",
            icon: "folder",
          },
          {
            name: "time-tracking",
            route: "/(tabs)/time-tracking",
            label: "Time",
            icon: "schedule",
          },
          {
            name: "shop",
            route: "/(tabs)/shop",
            label: "Shop",
            icon: "shopping-cart",
          },
        ]}
        containerWidth={340}
      />
    </>
  );
}
