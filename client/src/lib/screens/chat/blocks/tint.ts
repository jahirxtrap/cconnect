export type Tint = "orange" | "red" | "blue";

export const TINT_CLASS: Record<Tint, string> = {
  orange: "bg-background bg-linear-to-b from-orange/15 to-orange/15",
  red: "bg-background bg-linear-to-b from-red/15 to-red/15",
  blue: "bg-background bg-linear-to-b from-blue/15 to-blue/15",
};

export const TINT_TEXT_CLASS: Record<Tint, string> = {
  orange: "text-orange",
  red: "text-red",
  blue: "text-blue",
};
