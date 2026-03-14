"use client"

import { ReactNode } from "react"
import { WagmiProvider, createConfig, http } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { baseSepolia } from "wagmi/chains"
import { injected } from "wagmi/connectors"
import { AnonAadhaarProvider } from "@anon-aadhaar/react"
import { WalletProvider } from "@/contexts/WalletContext"

import "@rainbow-me/rainbowkit/styles.css"

const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
  },
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
            <WalletProvider>
              {children}
            </WalletProvider>
          </AnonAadhaarProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
