import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
export const jakarta = loadFont("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] });
export const inter = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
export const FONT = `${jakarta.fontFamily}, ${inter.fontFamily}, sans-serif`;
export const C = {
  green900: "#04301f", green800: "#064e32", green700: "#0a6b43", green600: "#0f8a56", green500: "#16a368",
  gold: "#e8c26a", ink: "#0b1d15", cream: "#f6f3ea", white: "#ffffff",
};
export const EASE = [0.32, 0.72, 0, 1] as const;
