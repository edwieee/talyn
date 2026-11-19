// Stable, locally generated decoration. No font download, image, or animation.
export function CharacterField() {
  const glyphs = "01{}[]<>/\\:;=+-*^%&()|~.$#@!?";
  let seed = 289;
  const lines = Array.from({ length: 34 }, () => Array.from({ length: 210 }, () => {
    seed = (seed * 16807) % 2147483647;
    return glyphs[seed % glyphs.length] + " ";
  }).join("")).join("\n");
  return <div className="character-field" aria-hidden="true"><pre>{lines}</pre></div>;
}
