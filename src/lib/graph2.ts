import * as Immutable from 'immutable';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

type Dimension =
  | 'territory'
  | 'niceTerm'
  | 'licensingChannel'
  | 'licensingType';

const ALL_DIMENSIONS: Dimension[] = [
  'territory',
  'niceTerm',
  'licensingChannel',
  'licensingType',
];

type Vertex = {
  dimension: Dimension;
  value: string;
};
type VertexMap = Map<Dimension, Set<string>>;

type Plan = number[];
type FilterState = {
  allNodes: VertexMap;
  selectedNodes: VertexMap;
  disabledNodes: VertexMap;
  optionalNodes: VertexMap;
  plans: Plan[];
};
interface PartialPath {
  pathArr: string[];
}
interface Path extends PartialPath {
  roomKey: string;
  value: string;
}

// SourcePathGroup对应一条BrandDetail所产生的所有Path
type SourcePathGroup = Path[];

// 一个TargetPathGroup所有Path之间要满足与的关系，即所有Path都要满足
type TargetPathGroup = PartialPath[] | Path[];

// 一个TargetPathCover所有PathGroup之间要满足或的关系，即只要有一个PathGroup满足即可
type TargetPathCover = TargetPathGroup[];

// 注册商标，每个注册商标可以组成若干Path
type BrandDetail = {
  territory: string[];
  niceTerm: string[];
  licensingChannel: string[];
  licensingType: string[]; // 1: exclusive 2: non-exclusive
};
type RawRestriction = {
  territory: string;
  niceTerm: string;
  licensingChannel: string;
  licensingTypeRestriction: '3' | '4' | '5'; // 3: exclusive only 4: non-exclusive only 5: neither
};
type Restriction = RawRestriction & {
  roomKey: string;
};

function getVertextGroupFromVertices(vertices: Vertex[]): VertexMap {
  const vertexMap: VertexMap = new Map();
  vertices.forEach((vertex) => {
    const val = vertex.value.toString();
    if (vertexMap.has(vertex.dimension)) {
      vertexMap.get(vertex.dimension).add(val);
    } else {
      vertexMap.set(vertex.dimension, new Set([val]));
    }
  });
  return vertexMap;
}

function buildDetailPathGroups(
  details: BrandDetail[],
  rawRestrictions: RawRestriction[]
): SourcePathGroup[] {
  console.time('buildDetailPathGroups');
  const restrictions: Restriction[] = rawRestrictions.map((rawRestriction) => ({
    ...rawRestriction,
    roomKey: `${rawRestriction.territory}:${rawRestriction.niceTerm}:${rawRestriction.licensingChannel}`,
  }));
  const detailPathGroups: SourcePathGroup[] = details.map(
    (detail: BrandDetail) => {
      const pathGroups: SourcePathGroup = [];
      detail.territory.forEach((territory) => {
        detail.niceTerm.forEach((niceTerm) => {
          detail.licensingChannel.forEach((licensingChannel) => {
            detail.licensingType.forEach((licensingType) => {
              const roomKey = `${territory}:${niceTerm}:${licensingChannel}`;
              const path: Path = {
                roomKey: `${territory}:${niceTerm}:${licensingChannel}`,
                value: `${territory}:${niceTerm}:${licensingChannel}:${licensingType}`,
                pathArr: [
                  territory,
                  niceTerm,
                  licensingChannel,
                  licensingType.toString(),
                ],
              };
              const restriction = restrictions.find(
                (restriction) => restriction.roomKey === roomKey
              );
              let isRestricted = false;
              if (restriction) {
                if (restriction.licensingTypeRestriction === '3') {
                  isRestricted = licensingType !== '1';
                } else if (restriction.licensingTypeRestriction === '4') {
                  isRestricted = licensingType !== '2';
                } else if (restriction.licensingTypeRestriction === '5') {
                  isRestricted = true;
                }
              }
              if (!isRestricted) {
                pathGroups.push(path);
              }
            });
          });
        });
      });
      return pathGroups;
    }
  );
  console.timeEnd('buildDetailPathGroups');
  return detailPathGroups;
}

function mergeInitFilterState(
  mockDetails: BrandDetail[],
  preSeletedNodes: VertexMap
): FilterState {
  const allNodes: VertexMap = new Map();
  mockDetails.forEach((detail) => {
    ALL_DIMENSIONS.forEach((dimension) => {
      if (allNodes.has(dimension)) {
        const set = allNodes.get(dimension);
        detail[dimension].forEach((value) => {
          set.add(value);
        });
      } else {
        allNodes.set(dimension, new Set(detail[dimension]));
      }
    });
  });
  const optionalNodes: VertexMap = new Map();
  allNodes.forEach((set, dimension) => {
    const optionalSet = new Set(set);
    const presetDimension = preSeletedNodes?.get(dimension);
    if (presetDimension) {
      presetDimension.forEach((value) => {
        optionalSet.delete(value);
      });
    }
    optionalNodes.set(dimension, optionalSet);
  });
  return {
    allNodes,
    selectedNodes: preSeletedNodes ?? new Map(),
    disabledNodes: new Map(),
    optionalNodes,
    plans: [],
  };
}
// function buildTargetCover(vertexMap: VertexMap): TargetPathCover {
//     const targetPathCover: TargetPathCover = [];
//     const vertexMapKeys = Array.from(vertexMap.keys());
//     const vertexMapValues = Array.from(vertexMap.values());
//     const vertexMapValuesLength = vertexMapValues.length;
// }

// function buildTargetCover

class FilterIterator {
  filterStateJS: FilterState;
  filterState: any;
  history: Map<string, any>;
  allPlans: Plan[];
  // 每条对应一个brandDetail，index不变，并且去除了restriction， 内容为path
  sourcePathGroups: SourcePathGroup[];
  constructor(
    brandDetails: BrandDetail[],
    rawRestrictions: RawRestriction[],
    presetSelectedNodes?: VertexMap
  ) {
    console.time('all');
    this.filterStateJS = mergeInitFilterState(
      brandDetails,
      presetSelectedNodes
    );
    this.filterState = Immutable.fromJS(this.filterStateJS);
    this.allPlans = [];

    this.sourcePathGroups = buildDetailPathGroups(
      brandDetails,
      rawRestrictions
    );
    this.generateAllPlans(0, []);
    if (presetSelectedNodes) {
      this.nextState(presetSelectedNodes);
    }
  }
  nextState(paramSelectedNodes: VertexMap) {
    // 1. 更新selectedNodes
    this.updateSelectedNodes(paramSelectedNodes);
    // 2. 计算plans
    const plans: Plan[] = this.calcPlanByAllFilterInfo();
    this.filterStateJS.plans = plans;
    // 3. 更新disabledNodes
    this.updateDisabledNodes();
    console.log('filterStateJS', this.filterStateJS);
    console.timeEnd('all');
  }
  updateSelectedNodes(paramSelectedNodes: VertexMap) {
    const { selectedNodes } = this.filterStateJS;
    paramSelectedNodes &&
      paramSelectedNodes.forEach(
        (valueSet: Set<string>, dimension: Dimension) => {
          const dim = dimension as Dimension;
          let existedSeletedSet = selectedNodes?.get(dim);
          if (!existedSeletedSet) {
            existedSeletedSet = new Set();
            selectedNodes.set(dim, existedSeletedSet);
          }
          valueSet.forEach((value) => {
            existedSeletedSet.add(value);
          });
          let existedOptionalSet = this.filterStateJS.optionalNodes.get(dim);
          if (!existedOptionalSet) {
            existedOptionalSet = new Set();
            this.filterStateJS.optionalNodes.set(dim, existedOptionalSet);
          }
          valueSet.forEach((value) => {
            existedOptionalSet.delete(value);
          });
        }
      );

    // 没有完成完整的步骤，不更新Immutable state
  }
  // 计算所有的方案，因为并不是算到某个最小方案就停止，所以使用全组合的方式，O(2^n)*O(d1*d2*d3*d4)，n为记录数（注册商标），di为每个维度可选维值
  calcPlanByAllFilterInfo(): Plan[] {
    let plans: Plan[] = [];
    const { selectedNodes, disabledNodes, optionalNodes } = this.filterStateJS;
    const targetPathCover = this.buildTargetPathCover();
    this.allPlans.forEach((curPlan: Plan) => {
      let isCovered = false;
      let curPlanPaths: Path[] = [];
      curPlan.forEach((planIndex: number) => {
        curPlanPaths = curPlanPaths.concat(this.sourcePathGroups[planIndex]);
      });
      targetPathCover.forEach((targetPathGroup: TargetPathGroup) => {
        let isGroupCovered = true;
        targetPathGroup.forEach((targetPath: Path) => {
          const isPathCovered = curPlanPaths.some((path) => {
            return path.value === targetPath.value;
          });
          if (!isPathCovered) {
            isGroupCovered = false;
            return;
          }
        });
        if (isGroupCovered) {
          isCovered = true;
          return;
        }
      });
      if (isCovered) {
        plans = this.checkRedundantPlansAndInsert(plans, curPlan);
      }
    });

    return plans;
  }
  generateAllPlans(deepth: number, curPlan: Plan) {
    if (deepth === this.sourcePathGroups.length) {
      this.allPlans.push(Array.from(curPlan));
      return;
    }
    // 不选的放前面，最后所有组合中也是条目少的排前面，有利redundant的检测
    this.generateAllPlans(deepth + 1, curPlan);
    this.generateAllPlans(deepth + 1, curPlan.concat(deepth));
  }

  checkRedundantPlansAndInsert(plans: Plan[], curPlan: Plan): Plan[] {
    // 1. 如果当前方案已经存在，不插入，直接返回
    let curIsRedundant = false;
    plans.forEach((plan) => {
      if (plan.length > curPlan.length) {
        return;
      }
      let isSame = true;
      plan.forEach((index) => {
        if (!curPlan.includes(index)) {
          isSame = false;
          return;
        }
      });
      if (isSame) {
        curIsRedundant = true;
        return;
      }
    });
    if (curIsRedundant) {
      return plans;
    }
    // 2. 如果已有方案包含当前方案，将所有冗余的已有方案替换为当前方案
    const newPlans = [];
    plans.forEach((plan) => {
      if (plan.length < curPlan.length) {
        newPlans.push(plan);
        return;
      }
      let isSame = true;
      curPlan.forEach((index) => {
        if (!plan.includes(index)) {
          isSame = false;
          return;
        }
      });
      if (isSame) {
        return;
      }
      newPlans.push(plan);
    });

    newPlans.push(curPlan);
    return newPlans;
  }

  buildTargetPathCover(): TargetPathCover {
    let targetPathCover: TargetPathCover = [];

    const { selectedNodes, disabledNodes, optionalNodes } = this.filterStateJS;
    ALL_DIMENSIONS.forEach((dimension: Dimension, index: number) => {
      const curDimensionHasSelectedNodes = hasDimension(
        selectedNodes,
        dimension
      );
      if (curDimensionHasSelectedNodes) {
        if (index === 0) {
          // 第一个维度，直接将selectedNodes的每个维值作为一个TargetPathGroup
          const newTargetPathGroup: PartialPath[] = [];
          selectedNodes.get(dimension).forEach((value) => {
            const newPath: PartialPath = {
              pathArr: [value],
            };
            newTargetPathGroup.push(newPath);
          });
          targetPathCover.push(newTargetPathGroup);
        } else {
          // 后续维度，将selectedNodes的每个维值与curTargetPathGroup的每个Path组合，组成新的TargetPathGroup
          const newTargetPathCover: TargetPathCover = [];
          targetPathCover.forEach((pathGroup) => {
            const newTargetPathGroup: TargetPathGroup = [];
            selectedNodes.get(dimension).forEach((value) => {
              pathGroup.forEach((path) => {
                let newPath: PartialPath = {
                  pathArr: [...path.pathArr, value],
                };
                if (index === ALL_DIMENSIONS.length - 1) {
                  newPath = {
                    ...newPath,
                    value: newPath.pathArr.join(':'),
                    roomKey: newPath.pathArr.slice(0, 3).join(':'),
                  } as Path;
                }
                newTargetPathGroup.push(newPath);
              });
            });
            newTargetPathCover.push(newTargetPathGroup);
          });
          targetPathCover = newTargetPathCover;
        }
      } else {
        if (index === 0) {
          // 第一个维度，将optionalNodes的每个维值作为一个TargetPathGroup
          optionalNodes.get(dimension).forEach((value) => {
            const newTargetPathGroup: TargetPathGroup = [];
            newTargetPathGroup.push({
              pathArr: [value],
            });
            targetPathCover.push(newTargetPathGroup);
          });
        } else {
          const newTargetPathCover: TargetPathCover = [];
          optionalNodes.get(dimension).forEach((value) => {
            targetPathCover.forEach((pathGroup) => {
              const newTargetPathGroup: TargetPathGroup = [];
              pathGroup.forEach((path) => {
                let newPath: PartialPath = {
                  pathArr: [...path.pathArr, value],
                };
                if (index === ALL_DIMENSIONS.length - 1) {
                  newPath = {
                    ...newPath,
                    value: newPath.pathArr.join(':'),
                    roomKey: newPath.pathArr.slice(0, 3).join(':'),
                  } as Path;
                }
                newTargetPathGroup.push(newPath);
              });
              newTargetPathCover.push(newTargetPathGroup);
            });
          });
          targetPathCover = newTargetPathCover;
        }
      }
    });

    return targetPathCover;
  }
  // 通过将剩下的每个optionalNode模拟加入selected来计算是否有方案，来判断
  updateDisabledNodes() {
    const { selectedNodes, disabledNodes, optionalNodes } = this.filterStateJS;
    optionalNodes.forEach((set, dimension) => {
      const dim = dimension as Dimension;

      set.forEach((value) => {
        const oldSelectedNodes = selectedNodes;
        const newSelectedNodes = new Map();
        selectedNodes.forEach((set, dimension) => {
          const dim = dimension as Dimension;
          newSelectedNodes.set(dim, new Set(set));
        });
        if (newSelectedNodes.has(dim)) {
          newSelectedNodes.get(dim).add(value);
        } else {
          newSelectedNodes.set(dim, new Set([value]));
        }
        this.filterStateJS.selectedNodes = newSelectedNodes;
        const plans: Plan[] = this.calcPlanByAllFilterInfo();
        if (plans.length === 0) {
          optionalNodes.get(dim).delete(value);
          if (disabledNodes.has(dim)) {
            disabledNodes.get(dim).add(value);
          } else {
            disabledNodes.set(dim, new Set([value]));
          }
        }
        this.filterStateJS.selectedNodes = oldSelectedNodes;
      });
    });
  }
}

function hasDimension(group: VertexMap, dim: Dimension): boolean {
  return group?.get(dim)?.size > 0;
}

function generateAllPlans(recordsLength: number): Plan[] {}

// 之后方案的index都使用此处details的index
const mockDetails: BrandDetail[] = [
  {
    territory: ['FR', 'IT', 'DE'],
    niceTerm: ['1', '2', '3'],
    licensingChannel: ['on', 'off'],
    licensingType: ['1', '2'],
  },
  {
    territory: ['GB', 'IN'],
    niceTerm: ['1', '2'],
    licensingChannel: ['on', 'off'],
    licensingType: ['1', '2'],
  },
  {
    territory: ['US', 'CA', 'GB', 'DE'],
    niceTerm: ['3', '4'],
    licensingChannel: ['on', 'off'],
    licensingType: ['1', '2'],
  },
];

const mockRestrictions: RawRestriction[] = [
  {
    territory: 'FR',
    niceTerm: '1',
    licensingChannel: 'on',
    licensingTypeRestriction: '3',
  },
  {
    territory: 'FR',
    niceTerm: '2',
    licensingChannel: 'on',
    licensingTypeRestriction: '3',
  },
  {
    territory: 'FR',
    niceTerm: '3',
    licensingChannel: 'on',
    licensingTypeRestriction: '3',
  },
];

// const groups = buildDetailPathGroups(mockDetails, mockRestrictions);
// console.log('groups', groups);

const iterator = new FilterIterator(mockDetails, mockRestrictions);
// iterator.nextState(new Map([['territory', new Set(['FR', 'US'])]]));
// iterator.nextState(new Map([['territory', new Set(['DE', 'GB', 'US'])]]));
iterator.nextState(
  new Map([
    ['territory', new Set(['FR'])],
    ['licensingChannel', new Set(['on'])],
  ])
);
