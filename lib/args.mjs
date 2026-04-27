// Parse KEY=VALUE positional args from argv and inject into process.env.
// Returns the remaining (non-KEY=VALUE) positional args in order.
//
// Usage at the top of an entry script:
//   import { applyEnvArgs } from "./args.mjs";
//   const positional = applyEnvArgs(process.argv.slice(2));
//
// Then `positional` contains the args without KEY=VALUE entries.

const KV = /^([A-Z][A-Z0-9_]*)=(.*)$/;

export function applyEnvArgs(argv) {
  const positional = [];
  for (const a of argv) {
    const m = KV.exec(a);
    if (m) process.env[m[1]] = m[2];
    else positional.push(a);
  }
  return positional;
}
