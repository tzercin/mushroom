declare module 'd3-force-3d' {
  // Minimal typing for the parts we use.
  export function forceSimulation(nodes?: any[], numDimensions?: number): any
  export function forceLink(links?: any[]): any
  export function forceManyBody(): any
  export function forceCollide(radius?: number | ((n: any) => number)): any
}
