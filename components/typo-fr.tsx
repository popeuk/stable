"use client";

import { useEffect } from "react";
import { suivreTypo } from "@/lib/utils/typo-dom";

/** Les insécables du français sur tout l'écran, posées après le réveil de React (lib/utils/typo-dom). */
export function TypoFr() {
  useEffect(() => suivreTypo(), []);
  return null;
}
