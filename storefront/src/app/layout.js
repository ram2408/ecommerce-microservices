import { Outfit } from "next/font/google";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import CartDrawer from "../components/CartDrawer";
import AppHeader from "../components/AppHeader";

const outfit = Outfit({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"]
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.className}>
      <body>
        <AppProvider>
          <div className="app-container animate-fade">
            <AppHeader />
            <main className="main-content">
              {children}
            </main>
            <CartDrawer />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
