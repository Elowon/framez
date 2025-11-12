import React from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient("https://modest-camel-498.convex.cloud");

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ConvexProvider>
  );
}