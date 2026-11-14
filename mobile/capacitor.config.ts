import type { CapacitorConfig } from "@capacitor/cli";

// The app is a thin shell: it loads the live website, so site updates reach the app without a new App Store build.
const config: CapacitorConfig = {
  appId: "app.yumjack.ios",
  appName: "Yumjack",
  webDir: "www",
  server: {
    url: "https://yumjack.app",
    errorPath: "offline.html",
    allowNavigation: ["yumjack.app"],
  },
  ios: {
    appendUserAgent: "YumjackApp/1",
    // The page draws its own space for the clock and home bar (html[data-app] CSS + viewport-fit=cover set by AppFlag),
    // so the sticky header stays solid behind the clock instead of the page scrolling under it.
    contentInset: "never",
  },
};

export default config;
