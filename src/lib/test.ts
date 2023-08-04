import { NodesGroup, createGraph, FilterIterator } from './graph';

const groups: NodesGroup[] = [
  {
    country: ['FR', 'IT', 'DE'],
    niceclass: ['1', '2', '3'],
  },
  {
    country: ['GB', 'IN'],
    niceclass: ['1', '2'],
  },
  {
    country: ['US', 'CA', 'GB', 'DE'],
    niceclass: ['3', '4'],
  },
];
console.time('t1');
const iterator = new FilterIterator(groups.map((g) => createGraph(g)));

function test(opt: any) {
  let testCases: number[] = [];
  if (typeof opt === 'number') {
    testCases.push(opt);
  } else if (Array.isArray(opt)) {
    testCases = opt;
  } else {
    testCases = [1, 2, 3, 4, 5, 6, 7, 8];
  }
  testCases.forEach((caseNum) => {
    executeCase(caseNum);
  });
}
const nodeActionMap = {
  1: [
    {
      node: 'country:FR',
      value: 'FR',
      dimension: 'country',
      behavior: 'add',
    },
  ],
  2: [
    {
      node: 'country:FR',
      value: 'FR',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:US',
      value: 'US',
      dimension: 'country',
      behavior: 'add',
    },
    // {
    //   node: 'country:IN',
    //   value: 'IN',
    //   dimension: 'country',
    //   behavior: 'add',
    // },
  ],
  3: [
    {
      node: 'country:FR',
      value: 'FR',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'niceclass:3',
      value: '3',
      dimension: 'niceclass',
      behavior: 'add',
    },
  ],
  4: [
    {
      node: 'country:GB',
      value: 'GB',
      dimension: 'country',
      behavior: 'add',
    },
  ],
  5: [
    {
      node: 'country:GB',
      value: 'GB',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'niceclass:3',
      value: '3',
      dimension: 'niceclass',
      behavior: 'add',
    },
  ],
  6: [
    {
      node: 'country:GB',
      value: 'GB',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:DE',
      value: 'DE',
      dimension: 'country',
      behavior: 'add',
    },
  ],
  7: [
    {
      node: 'country:GB',
      value: 'GB',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:DE',
      value: 'DE',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:US',
      value: 'US',
      dimension: 'country',
      behavior: 'add',
    },
  ],
  8: [
    {
      node: 'country:GB',
      value: 'GB',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:DE',
      value: 'DE',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:US',
      value: 'US',
      dimension: 'country',
      behavior: 'add',
    },
    {
      node: 'country:FR',
      value: 'FR',
      dimension: 'country',
      behavior: 'add',
    },
  ],
};
function executeCase(caseNum: number) {
  console.log(`---------Case ${caseNum} BEGIN---------`);
  console.time(`case ${caseNum} execution time`);
  const nodeActions = nodeActionMap[caseNum];
  const status = iterator.nextState(nodeActions);
  console.log('status', status);
  console.timeEnd(`case ${caseNum} execution time`);
  console.log(`---------Case ${caseNum} END-----------`);
  iterator.clear();
}

export default test;
