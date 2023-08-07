import * as Immutable from 'immutable';
const ALL_DIMENSIONS = [
    'territory',
    'niceTerm',
    'licensingChannel',
    'licensingType',
];
function getVertextGroupFromVertices(vertices) {
    const vertexMap = new Map();
    vertices.forEach((vertex) => {
        const val = vertex.value.toString();
        if (vertexMap.has(vertex.dimension)) {
            vertexMap.get(vertex.dimension).add(val); // <-- no error
        }
        else {
            vertexMap.set(vertex.dimension, new Set([val]));
        }
    });
    return vertexMap;
}
function buildDetailPathGroups(details, rawRestrictions) {
    console.time('buildDetailPathGroups');
    const restrictions = rawRestrictions.map((rawRestriction) => (Object.assign(Object.assign({}, rawRestriction), { roomKey: `${rawRestriction.territory}:${rawRestriction.niceTerm}:${rawRestriction.licensingChannel}` })));
    const detailPathGroups = details.map((detail) => {
        const pathGroups = [];
        detail.territory.forEach((territory) => {
            detail.niceTerm.forEach((niceTerm) => {
                detail.licensingChannel.forEach((licensingChannel) => {
                    detail.licensingType.forEach((licensingType) => {
                        const roomKey = `${territory}:${niceTerm}:${licensingChannel}`;
                        const path = {
                            roomKey: `${territory}:${niceTerm}:${licensingChannel}`,
                            value: `${territory}:${niceTerm}:${licensingChannel}:${licensingType}`,
                            pathArr: [
                                territory,
                                niceTerm,
                                licensingChannel,
                                licensingType.toString(),
                            ],
                        };
                        const restriction = restrictions.find((restriction) => restriction.roomKey === roomKey);
                        let isRestricted = false;
                        if (restriction) {
                            if (restriction.licensingTypeRestriction === '3') {
                                isRestricted = licensingType !== '1';
                            }
                            else if (restriction.licensingTypeRestriction === '4') {
                                isRestricted = licensingType !== '2';
                            }
                            else if (restriction.licensingTypeRestriction === '5') {
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
    });
    console.timeEnd('buildDetailPathGroups');
    return detailPathGroups;
}
function mergeInitFilterState(mockDetails, preSeletedNodes) {
    const allNodes = new Map();
    mockDetails.forEach((detail) => {
        ALL_DIMENSIONS.forEach((dimension) => {
            if (allNodes.has(dimension)) {
                const set = allNodes.get(dimension);
                detail[dimension].forEach((value) => {
                    set.add(value);
                });
            }
            else {
                allNodes.set(dimension, new Set(detail[dimension]));
            }
        });
    });
    const optionalNodes = new Map();
    allNodes.forEach((set, dimension) => {
        const optionalSet = new Set(set);
        const presetDimension = preSeletedNodes === null || preSeletedNodes === void 0 ? void 0 : preSeletedNodes.get(dimension);
        if (presetDimension) {
            presetDimension.forEach((value) => {
                optionalSet.delete(value);
            });
        }
        optionalNodes.set(dimension, optionalSet);
    });
    return {
        allNodes,
        selectedNodes: preSeletedNodes !== null && preSeletedNodes !== void 0 ? preSeletedNodes : new Map(),
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
    constructor(brandDetails, rawRestrictions, presetSelectedNodes) {
        console.time('all');
        this.filterStateJS = mergeInitFilterState(brandDetails, presetSelectedNodes);
        this.filterState = Immutable.fromJS(this.filterStateJS);
        this.allPlans = [];
        this.sourcePathGroups = buildDetailPathGroups(brandDetails, rawRestrictions);
        this.generateAllPlans(0, []);
        if (presetSelectedNodes) {
            this.nextState(presetSelectedNodes);
        }
    }
    nextState(paramSelectedNodes) {
        // 1. 更新selectedNodes
        this.updateSelectedNodes(paramSelectedNodes);
        // 2. 计算plans
        const plans = this.calcPlanByAllFilterInfo();
        this.filterStateJS.plans = plans;
        // 3. 更新disabledNodes
        this.updateDisabledNodes();
        console.log('filterStateJS', this.filterStateJS);
        console.timeEnd('all');
    }
    updateSelectedNodes(paramSelectedNodes) {
        const { selectedNodes } = this.filterStateJS;
        paramSelectedNodes &&
            paramSelectedNodes.forEach((valueSet, dimension) => {
                const dim = dimension;
                let existedSeletedSet = selectedNodes === null || selectedNodes === void 0 ? void 0 : selectedNodes.get(dim);
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
            });
        // 没有完成完整的步骤，不更新Immutable state
    }
    // 计算所有的方案，因为并不是算到某个最小方案就停止，所以使用全组合的方式，O(2^n)*O(d1*d2*d3*d4)，n为记录数（注册商标），di为每个维度可选维值
    calcPlanByAllFilterInfo() {
        let plans = [];
        const { selectedNodes, disabledNodes, optionalNodes } = this.filterStateJS;
        const targetPathCover = this.buildTargetPathCover();
        this.allPlans.forEach((curPlan) => {
            let isCovered = false;
            let curPlanPaths = [];
            curPlan.forEach((planIndex) => {
                curPlanPaths = curPlanPaths.concat(this.sourcePathGroups[planIndex]);
            });
            targetPathCover.forEach((targetPathGroup) => {
                let isGroupCovered = true;
                targetPathGroup.forEach((targetPath) => {
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
    generateAllPlans(deepth, curPlan) {
        if (deepth === this.sourcePathGroups.length) {
            this.allPlans.push(Array.from(curPlan));
            return;
        }
        // 不选的放前面，最后所有组合中也是条目少的排前面，有利redundant的检测
        this.generateAllPlans(deepth + 1, curPlan);
        this.generateAllPlans(deepth + 1, curPlan.concat(deepth));
    }
    checkRedundantPlansAndInsert(plans, curPlan) {
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
    buildTargetPathCover() {
        let targetPathCover = [];
        const { selectedNodes, disabledNodes, optionalNodes } = this.filterStateJS;
        ALL_DIMENSIONS.forEach((dimension, index) => {
            const curDimensionHasSelectedNodes = hasDimension(selectedNodes, dimension);
            if (curDimensionHasSelectedNodes) {
                if (index === 0) {
                    // 第一个维度，直接将selectedNodes的每个维值作为一个TargetPathGroup
                    const newTargetPathGroup = [];
                    selectedNodes.get(dimension).forEach((value) => {
                        const newPath = {
                            pathArr: [value],
                        };
                        newTargetPathGroup.push(newPath);
                    });
                    targetPathCover.push(newTargetPathGroup);
                }
                else {
                    // 后续维度，将selectedNodes的每个维值与curTargetPathGroup的每个Path组合，组成新的TargetPathGroup
                    const newTargetPathCover = [];
                    targetPathCover.forEach((pathGroup) => {
                        const newTargetPathGroup = [];
                        selectedNodes.get(dimension).forEach((value) => {
                            pathGroup.forEach((path) => {
                                let newPath = {
                                    pathArr: [...path.pathArr, value],
                                };
                                if (index === ALL_DIMENSIONS.length - 1) {
                                    newPath = Object.assign(Object.assign({}, newPath), { value: newPath.pathArr.join(':'), roomKey: newPath.pathArr.slice(0, 3).join(':') });
                                }
                                newTargetPathGroup.push(newPath);
                            });
                        });
                        newTargetPathCover.push(newTargetPathGroup);
                    });
                    targetPathCover = newTargetPathCover;
                }
            }
            else {
                if (index === 0) {
                    // 第一个维度，将optionalNodes的每个维值作为一个TargetPathGroup
                    optionalNodes.get(dimension).forEach((value) => {
                        const newTargetPathGroup = [];
                        newTargetPathGroup.push({
                            pathArr: [value],
                        });
                        targetPathCover.push(newTargetPathGroup);
                    });
                }
                else {
                    const newTargetPathCover = [];
                    optionalNodes.get(dimension).forEach((value) => {
                        targetPathCover.forEach((pathGroup) => {
                            const newTargetPathGroup = [];
                            pathGroup.forEach((path) => {
                                let newPath = {
                                    pathArr: [...path.pathArr, value],
                                };
                                if (index === ALL_DIMENSIONS.length - 1) {
                                    newPath = Object.assign(Object.assign({}, newPath), { value: newPath.pathArr.join(':'), roomKey: newPath.pathArr.slice(0, 3).join(':') });
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
            const dim = dimension;
            set.forEach((value) => {
                const oldSelectedNodes = selectedNodes;
                const newSelectedNodes = new Map();
                selectedNodes.forEach((set, dimension) => {
                    const dim = dimension;
                    newSelectedNodes.set(dim, new Set(set));
                });
                if (newSelectedNodes.has(dim)) {
                    newSelectedNodes.get(dim).add(value);
                }
                else {
                    newSelectedNodes.set(dim, new Set([value]));
                }
                this.filterStateJS.selectedNodes = newSelectedNodes;
                const plans = this.calcPlanByAllFilterInfo();
                if (plans.length === 0) {
                    optionalNodes.get(dim).delete(value);
                    if (disabledNodes.has(dim)) {
                        disabledNodes.get(dim).add(value);
                    }
                    else {
                        disabledNodes.set(dim, new Set([value]));
                    }
                }
                this.filterStateJS.selectedNodes = oldSelectedNodes;
            });
        });
    }
}
function hasDimension(group, dim) {
    var _a;
    return ((_a = group === null || group === void 0 ? void 0 : group.get(dim)) === null || _a === void 0 ? void 0 : _a.size) > 0;
}
function generateAllPlans(recordsLength) { }
// 之后方案的index都使用此处details的index
const mockDetails = [
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
const mockRestrictions = [
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
iterator.nextState(new Map([
    ['territory', new Set(['FR'])],
    ['licensingChannel', new Set(['on'])],
]));
