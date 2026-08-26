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
        {/* Extended font catalogue (38 additional fonts for the font picker).
            See src/lib/fonts.ts for the full list. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Cardo:ital,wght@0,400;0,700;1,400&family=Gelasio:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Aleo:wght@300;400;700&family=Yeseva+One&family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Bitter:ital,wght@0,400;0,700;1,400&family=Marcellus&family=Cormorant+SC:wght@300;400;500;600;700&family=Forum&family=Balthazar&family=Playfair+Display+SC:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Inter:wght@300;400;500;600;700&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Manrope:wght@300;400;500;600;700&family=Mulish:ital,wght@0,400;0,600;0,700;1,400&family=Karla:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Heebo:wght@300;400;500;700&family=Pinyon+Script&family=Italianno&family=Mrs+Saint+Delafield&family=Rochester&family=La+Belle+Aurore&family=League+Script&family=Redressed&family=Marck+Script&family=Kalam:wght@300;400;700&family=Patrick+Hand&family=Indie+Flower&family=Shadows+Into+Light&family=Gochi+Hand&family=Reenie+Beanie&family=Architects+Daughter&family=Nanum+Pen+Script&display=swap"
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