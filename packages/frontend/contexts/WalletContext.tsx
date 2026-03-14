"use client"

import { createContext, useContext } from "react"
import { useAccount } from "wagmi"

interface WalletContextValue {
  address: `0x${string}` | undefined
  isConnected: boolean
}

const WalletContext = createContext<WalletContextValue>({
  address: undefined,
  isConnected: false,
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  return (
    <WalletContext.Provider value={{ address, isConnected }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
