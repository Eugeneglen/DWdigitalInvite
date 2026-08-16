import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./tailwind-output.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/providers/SessionProvider";

const playfair = localFont({
  src: [
    {
      path: "../fonts/PlayfairDisplay-Regular.woff2",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "../fonts/PlayfairDisplay-Italic.woff2",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--font-playfair",
  display: "swap",
});

const inter = localFont({
  src: [
    {
      path: "../fonts/Inter.woff2",
      weight: "300 600",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#D4AF37",
};

export const metadata: Metadata = {
  title: {
    default: "Dreamweavers — Digital Wedding Invitations",
    template: "%s — Dreamweavers",
  },
  description: "Create beautiful, cinematic digital wedding invitations. Dreamweavers transforms your love story into an unforgettable online experience for your guests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700&family=Lato:wght@300;400;700&family=Great+Vibes&family=Dancing+Script:wght@400;500;600;700&family=Josefin+Sans:wght@300;400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&family=DM+Serif+Display:ital@0;1&family=Cinzel:wght@400;500;600;700;800;900&family=Cinzel+Decorative:wght@400;700;900&family=Prata&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Bodoni+Moda:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Italiana&family=Philosopher:ital,wght@0,400;0,700;1,400&family=Poppins:wght@300;400;500;600;700&family=Quicksand:wght@300;400;500;600;700&family=Nunito:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Work+Sans:wght@300;400;500;600;700&family=Alex+Brush&family=Allura&family=Parisienne&family=Tangerine&family=Sacramento&family=Kaushan+Script&family=Pacifico&family=Satisfy&family=Lobster&family=Caveat:wght@400;500;600;700&family=Amatic+SC:wght@400;700&family=Petit+Formal+Script&family=Cookie&family=Yellowtail&family=Arizonia&display=swap"
        />
      </head>
      <body suppressHydrationWarning className={`${playfair.variable} ${inter.variable} antialiased bg-paper-cream text-charcoal-ink overflow-x-hidden`}>
        <SessionProvider>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}