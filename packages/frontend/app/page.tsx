"use client"
import dynamic from "next/dynamic"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAnonAadhaar } from "@anon-aadhaar/react"
import { useEffect } from "react"

const LogInWithAnonAadhaar = dynamic(
  () => import("@anon-aadhaar/react").then((mod) => mod.LogInWithAnonAadhaar),
  { ssr: false }
)

const page = () => {
  const [anonAadhaar] = useAnonAadhaar()

  useEffect(() => {
    console.log("Anon Aadhaar status: ", anonAadhaar.status)
  }, [anonAadhaar])
  return (
    <div>
      <ConnectButton
        accountStatus={{
          smallScreen: "avatar",
          largeScreen: "full",
        }}
      />
      <LogInWithAnonAadhaar
        nullifierSeed={1234}
        fieldsToReveal={[
          "revealAgeAbove18",
          "revealPinCode",
          "revealGender",
          "revealState",
        ]}
      />
      <p>{anonAadhaar?.status}</p>
      <div className="aspect-square h-20"></div>
    </div>
  )
}

export default page
