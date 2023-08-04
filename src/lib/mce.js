import { createGraph } from './graph.ts';
import { union, intersect, complement } from './set';
export function test() {}
// const recordData = [
//   {
//     country: ['FR', 'IT', 'DE'],
//     niceclass: ['1', '2', '3'],
//   },
//   {
//     country: ['GB', 'IN'],
//     niceclass: ['1', '2'],
//   },
//   {
//     country: ['US', 'CA', 'GB', 'DE'],
//     niceclass: ['3', '4'],
//   },
// ];
// const filterState = {
//   country: {
//     all: union(...recordData.map((r) => r.country)),
//     selected: new Set(),
//     disabled: new Set(),
//   },
//   niceclass: {
//     all: union(...recordData.map((r) => r.niceclass)),
//     selected: new Set(),
//     disabled: new Set(),
//   },
// };

// const recordSubGraphs = recordData.map((r) => {
//   const vertexes = Object.entries(r).map(([key, values]) => ({
//     dimension: key,
//     values,
//   }));
//   return createGraph(vertexes);
// });
// console.log('recordSubGraphs', recordSubGraphs);
