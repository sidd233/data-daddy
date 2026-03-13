"use client"

import { ReactNode } from "react"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit"
import { baseSepolia } from "wagmi/chains"
import { AnonAadhaarProvider } from "@anon-aadhaar/react"

import "@rainbow-me/rainbowkit/styles.css"

const config = getDefaultConfig({
  appName: "DataDaddy",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [baseSepolia],
  ssr: true,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00E5A0",
            accentColorForeground: "#03030A",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          <AnonAadhaarProvider
            _useTestAadhaar={true}
            _artifactslinks={{
              zkey_url: "/circuit_final.zkey",
              vkey_url: "/vkey.json",
              wasm_url: "/aadhaar-verifier.wasm",
            }}
          >
            {children}
          </AnonAadhaarProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
