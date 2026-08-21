declare module 'sharp' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- compatibility shim for sharp 0.35 ESM export map
  const sharp: any;
  export default sharp;
}
