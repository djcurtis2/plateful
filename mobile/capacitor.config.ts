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
    contentInset: "automatic",
  },
};

export default config;
