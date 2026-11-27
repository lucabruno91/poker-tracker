/** Toglie il BOM, normalizza le fine riga in "\n" e toglie gli spazi a fine riga. */
export function normalizeText(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "");
}

/**
 * Divide il contenuto di un file in testi di mano.
 * Le mani sono separate da due o più righe vuote; i blocchi vuoti si scartano.
 */
export function splitHands(fileText: string): string[] {
  return normalizeText(fileText)
    .split(/\n{3,}/)
    .map((block) => block.replace(/^\n+|\n+$/g, ""))
    .filter((block) => block.trim().length > 0);
}
