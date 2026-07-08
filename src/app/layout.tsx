import type { Metadata } from "next"
import { Inter, Teko } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const teko = Teko({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-teko" })

export const metadata: Metadata = {
  title: "Big Tex Cooking Engine",
  description: "Y'all got ingredients? We got recipes. AI-powered Texas-sized recipe generator.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${teko.variable} ${inter.className}`}>{children}</body>
    </html>
  )
}
