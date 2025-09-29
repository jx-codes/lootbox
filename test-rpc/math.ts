// Math RPC functions

export function add(args: { a: number; b: number }): number {
  return args.a + args.b;
}

export function multiply(args: { a: number; b: number }): number {
  return args.a * args.b;
}
