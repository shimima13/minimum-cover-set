import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import * as Immutable from 'immutable';
// `${dimension}:{value}`
type Vertex = `${string}:${string}`;

type Edge = [Vertex, Vertex];

namespace Edge {
  export function isEqual(edge1: Edge, edge2: Edge): boolean {
    return (
      (edge1[0] === edge2[0] && edge1[1] === edge2[1]) ||
      (edge1[0] === edge2[1] && edge1[1] === edge2[0])
    );
  }
}
interface NodesGroup {
  [dimension: string]: string[];
}
class Graph {
  vertices: Vertex[];
  edges: Edge[];
  id: string;
  index?: number;
  constructor(vertices: Vertex[], edges: Edge[]) {
    this.vertices = vertices;
    this.edges = edges;
    this.id = uuidv4();
  }
  // 可以不用到， 直接id判断即可
  static isEqual(graph1: Graph, graph2: Graph): boolean {
    return (
      graph1.vertices.length === graph2.vertices.length &&
      graph1.edges.length === graph2.edges.length &&
      graph1.vertices.every((vertex) => graph2.vertices.includes(vertex)) &&
      graph1.edges.every((edge) =>
        graph2.edges.some((e) => Edge.isEqual(edge, e))
      )
    );
  }
}

// SourceGraphs的index
// 请注意，这里的Cover不是图论中的边/点覆盖，而是一种组合，满足将Cover中的所有图（记录Graph，也即一个注册商标）作并操作后得到的图G-Union，
// 目标图G-Target是G-Union的子图。这样的一个组合(Cover视为一个可行方案)
// 另外，需要保证Cover最小，定义最小：去掉任意一个构成Cover的元素后，G-Target不再是G-Union‘的子图
type Cover = number[];

// 哈希函数，将参数转换为哈希值
function getHash(params) {
  return CryptoJS.MD5(JSON.stringify(params));
}

type NodeAction = {
  node: Vertex;
  value: string;
  dimension: string;
  behavior: 'add' | 'remove';
};
class FilterIterator {
  status: any;
  statusJS: any;
  allSourceGraphs: Graph[];
  historyMap: Map<string, any>;
  constructor(sourceGraphs: Graph[]) {
    const minimumCoversIndex = [];
    this.allSourceGraphs = sourceGraphs;
    const selectedNodes: NodesGroup = {};
    const disabledNodes: NodesGroup = {};

    this.statusJS = {
      minimumCoversIndex,
      selectedNodes,
      disabledNodes,
    };
    const optionalNodes: NodesGroup = this.getCurOptionNodes();
    this.statusJS.optionalNodes = optionalNodes;
    this.status = Immutable.fromJS(this.statusJS);
    this.historyMap = new Map();
    this.historyMap.set(getHash(selectedNodes), this.status);
    this.historyMap.set('init', this.status);
  }
  // needToFindDisables: 是否需要寻找disabledNodes
  // 默认为true，会将其他可选结点作为nodeAction调用nextState查看
  nextState(nodeActions: NodeAction[]): any {
    const { minimumCoversIndex, selectedNodes } = this.statusJS;
    this.checkNodeActionsValid(nodeActions);

    // 1. 更新selectedNodes
    const newSelectedNodes = this.getNewSelectedNodes(
      selectedNodes,
      nodeActions
    );
    this.statusJS.selectedNodes = newSelectedNodes;
    // 2. 计算minimumCoversIndex
    let newMinimumCoversIndex: any[] = [];
    const newTargetGraph = createGraph(newSelectedNodes);
    if (nodeActions.length === 1 && nodeActions[0].behavior === 'add') {
      newMinimumCoversIndex = getCoversBasedOnPreviousCovers(
        newTargetGraph,
        this.allSourceGraphs,
        minimumCoversIndex
      );
    } else {
      newMinimumCoversIndex = getAllMinimumCovers(
        newTargetGraph,
        this.allSourceGraphs
      );
    }
    this.statusJS.minimumCoversIndex = newMinimumCoversIndex;

    // 3. 计算disabledNodes
    // const step1DisabledNodes = this.getDisabledNodes();
    // this.statusJS.disabledNodes = step1DisabledNodes;
    // const appendOptionalNodeActions = this.getAppendOptionalNodeActions();
    // const appendOptionalNodeActions = [];
    const newDisabledNodes = this.getDisabledNodes();
    Object.entries(newDisabledNodes).forEach(([dimension, values]) => {
      if (!newDisabledNodes[dimension]) {
        newDisabledNodes[dimension] = [];
      }
      newDisabledNodes[dimension] = newDisabledNodes[dimension].concat(values);
      newDisabledNodes[dimension] = Array.from(
        new Set(newDisabledNodes[dimension])
      );
    });
    this.statusJS.disabledNodes = newDisabledNodes;

    // 4. 更新historyMap
    const hash = getHash(newSelectedNodes);
    if (!this.historyMap.has(hash)) {
      const temp1 = this.status.updateIn(
        ['minimumCoversIndex'],
        () => newMinimumCoversIndex
      );
      const temp2 = temp1.updateIn(['selectedNodes'], () => newSelectedNodes);
      const temp3 = temp2.updateIn(['disabledNodes'], () => newDisabledNodes);
      this.status = temp3;
      this.historyMap.set(hash, this.status);
    }
    return this.statusJS;
  }

  getCurOptionNodes() {
    const { selectedNodes, disabledNodes } = this.statusJS;
    const allNodesArr = this.allSourceGraphs.flatMap((graph) => graph.vertices);
    const allNodes = new Set(allNodesArr);
    const optionalNodes: NodesGroup = {};
    allNodes.forEach((node) => {
      const { dimension, value } = this.getNodeInfo(node);
      let isSeleted = false;
      let isDisabled = false;
      if (
        selectedNodes[dimension] &&
        selectedNodes[dimension].includes(value)
      ) {
        isSeleted = true;
      }
      if (
        disabledNodes[dimension] &&
        disabledNodes[dimension].includes(value)
      ) {
        isDisabled = true;
      }
      if (!isSeleted && !isDisabled) {
        if (!optionalNodes[dimension]) {
          optionalNodes[dimension] = [];
        }
        optionalNodes[dimension].push(value);
      }
    });
    return optionalNodes;
  }

  getDisabledNodes(): NodesGroup {
    const newDisabledNodes: NodesGroup = {};

    const curOptionalNodes: NodesGroup = this.getCurOptionNodes();
    this.statusJS.optionalNodes = curOptionalNodes;
    const optionalNodeActions: NodeAction[] = [];
    Object.entries(curOptionalNodes).forEach(([dimension, values]) => {
      values.forEach((value) => {
        optionalNodeActions.push({
          node: `${dimension}:${value}`,
          value,
          dimension,
          behavior: 'add',
        });
      });
    });

    optionalNodeActions.forEach((nodeAction) => {
      const nextNodeActions = [nodeAction];
      // appendOptionalNodeActions.forEach((appendNodeAction) => {
      //   if (appendNodeAction.dimension !== nodeAction.dimension) {
      //     nextNodeActions.push(appendNodeAction);
      //   }
      // });
      const nextSelectedNodes = this.getNewSelectedNodes(
        this.statusJS.selectedNodes,
        nextNodeActions
      );
      const nextTargetGraph = createGraph(nextSelectedNodes);
      const nextMinimumCoversIndex = getCoversBasedOnPreviousCovers(
        nextTargetGraph,
        this.allSourceGraphs,
        this.statusJS.minimumCoversIndex
      );
      if (nextMinimumCoversIndex.length === 0) {
        if (!newDisabledNodes[nodeAction.dimension]) {
          newDisabledNodes[nodeAction.dimension] = [];
        }
        newDisabledNodes[nodeAction.dimension].push(nodeAction.value);
      }

      // 如果当前的图没选另一个维度，也就是没边（这里在3维度时需要改造），那么需要判断是否加上任意边都不能有有效cover，如果是的话那么当前这个顶点也是disabled的
      if (nextTargetGraph.edges.length === 0) {
        let hasValidEdge = false;
        optionalNodeActions.forEach((innerNodeAction) => {
          if (innerNodeAction.dimension !== nodeAction.dimension) {
            const innerNextSelectedNodes = this.getNewSelectedNodes(
              this.statusJS.selectedNodes,
              [nodeAction, innerNodeAction]
            );
            const innerTargetGraph = createGraph(innerNextSelectedNodes);
            const innerMinimumCoversIndex = getCoversBasedOnPreviousCovers(
              innerTargetGraph,
              this.allSourceGraphs,
              this.statusJS.minimumCoversIndex
            );
            if (innerMinimumCoversIndex.length > 0) {
              hasValidEdge = true;
              return;
            }
          }
        });
        if (!hasValidEdge) {
          if (!newDisabledNodes[nodeAction.dimension]) {
            newDisabledNodes[nodeAction.dimension] = [];
          }
          newDisabledNodes[nodeAction.dimension].push(nodeAction.value);
        }
      }
    });
    return newDisabledNodes;
  }
  getAppendOptionalNodeActions(): NodeAction[] {
    const appendOptionalNodeActions: NodeAction[] = [];
    const curOptionalNodes: NodesGroup = this.getCurOptionNodes();
    Object.entries(curOptionalNodes).forEach(([dimension, values]) => {
      if (values.length === 1) {
        appendOptionalNodeActions.push({
          node: `${dimension}:${values[0]}`,
          value: values[0],
          dimension,
          behavior: 'add',
        });
      }
    });
    return appendOptionalNodeActions;
  }
  checkNodeActionsValid(nodeActions: NodeAction[]) {
    const { selectedNodes, disabledNodes } = this.statusJS;
    if (selectedNodes.length > 0 || disabledNodes.length > 0) {
      nodeActions.forEach((nodeAction) => {
        const { node, value, dimension, behavior } = nodeAction;
        if (behavior === 'add') {
          if (
            selectedNodes[dimension] &&
            selectedNodes[dimension].includes(value)
          ) {
            throw new Error(`cannot add '${node}': it has been selected`);
          }
          if (
            disabledNodes[dimension] &&
            disabledNodes[dimension].includes(value)
          ) {
            throw new Error(`cannot add '${node}': it is disabled`);
          }
        } else {
          if (!selectedNodes[dimension].includes(value)) {
            throw new Error(`cannot add '${node}': it has been selected`);
          }
        }
      });
    }
  }
  getNodeInfo(node: Vertex) {
    const [dimension, value] = node.split(/:(.*)/);
    return { dimension, value };
  }
  getNewSelectedNodes(oldSelectedNodes, nodeActions) {
    const curSelectedNodes = {};
    Object.keys(oldSelectedNodes).forEach((key) => {
      curSelectedNodes[key] = oldSelectedNodes[key].slice();
    });
    nodeActions.forEach((nodeAction) => {
      const { value, dimension, behavior } = nodeAction;
      if (!curSelectedNodes[dimension]) {
        curSelectedNodes[dimension] = [];
      }
      if (behavior === 'add') {
        curSelectedNodes[dimension].push(value);
      } else {
        curSelectedNodes[dimension] = curSelectedNodes[dimension].filter(
          (v) => v !== value
        );
      }
      if (curSelectedNodes[dimension]) curSelectedNodes[dimension].sort();
    });
    return curSelectedNodes;
  }
  checkNodeDisabled(node: Vertex): boolean {
    const { minimumCoversIndex, selectedNodes } = this.statusJS;
    const { dimension, value } = this.getNodeInfo(node);
    const newSelectedNodes = {};
    Object.keys(selectedNodes).forEach((key) => {
      newSelectedNodes[key] = selectedNodes[key].slice();
      if (key === dimension) {
        newSelectedNodes[key].push(value);
      }
    });
    const newTargetGraph = createGraph(newSelectedNodes);
    const newMinimumCoversIndex = getCoversBasedOnPreviousCovers(
      newTargetGraph,
      this.allSourceGraphs,
      minimumCoversIndex
    );
    if (newMinimumCoversIndex.length === 0) {
      return true;
    }

    return false;
  }
  clear() {
    const initStatus = this.historyMap.get('init');
    this.status = initStatus;
    this.statusJS = initStatus.toJS();
  }
}

function isValidCover(targetGraph: Graph, recordGraphs: Graph[]): boolean {
  const targetVertices = targetGraph.vertices;
  const targetEdges = targetGraph.edges;

  const recordVertices = recordGraphs.flatMap((graph) => graph.vertices);
  const recordEdges = recordGraphs.flatMap((graph) => graph.edges);

  // 检查是否覆盖了所有顶点
  for (const targetVertex of targetVertices) {
    if (!recordVertices.includes(targetVertex)) {
      return false;
    }
  }

  // 检查是否覆盖了所有边
  for (const targetEdge of targetEdges) {
    if (
      !recordEdges.some((recordEdge) => Edge.isEqual(targetEdge, recordEdge))
    ) {
      return false;
    }
  }

  return true;
}

function processRedundantCover(
  // 此次准备添加的Cover
  curCover: Cover,
  // 目前为止的合法Cover
  partialValidCovers: Cover[]
): Cover[] {
  // step 1, 处理当前Cover是某个已有Cover的超集的情况（当前Cover冗余）
  let curIsRedundant = false;
  const resultCovers: Cover[] = [];
  for (const someValidCover of partialValidCovers) {
    if (isPartialCover(someValidCover, curCover)) {
      curIsRedundant = true;
      break;
    }
  }
  if (!curIsRedundant) {
    resultCovers.push(Array.from(curCover));
  }
  // step 2, 处理当前Cover是某些已有Cover的子集的情况（那些已有cover冗余）
  for (const someValidCover of partialValidCovers) {
    if (isPartialCover(curCover, someValidCover, true)) {
      continue;
    }
    resultCovers.push(someValidCover);
  }
  return resultCovers;
}

// real表示真子集
function isPartialCover(
  targetCover: Cover,
  sourceCover: Cover,
  real: boolean = false
): boolean {
  const lengthCompare = real
    ? targetCover.length < sourceCover.length
    : targetCover.length <= sourceCover.length;
  return (
    lengthCompare && targetCover.every((t) => sourceCover.some((s) => s === t))
  );
}

function getAllMinimumCovers(
  targetGraph: Graph,
  sourceGraphs: Graph[]
): Cover[] {
  const curCover: Cover = [];
  let allCovers: Cover[] = [];
  const sourceGraphsWithIndex = sourceGraphs.map((graph, index) => ({
    index,
    ...graph,
  }));
  function backtrack(depth: number) {
    if (
      isValidCover(
        targetGraph,
        curCover.map((cIndex) => sourceGraphsWithIndex[cIndex])
      )
    ) {
      allCovers = processRedundantCover(curCover, allCovers);
      return;
    }
    if (depth >= sourceGraphsWithIndex.length) {
      return;
    }
    for (const sourceGraph of sourceGraphsWithIndex) {
      if (curCover.some((cIndex) => cIndex === sourceGraph.index)) {
        continue;
      }
      curCover.push(sourceGraph.index);
      backtrack(depth + 1);
      curCover.pop();
    }
  }
  backtrack(0);
  return allCovers;
}

function getCoversBasedOnPreviousCovers(
  targetGraph: Graph,
  sourceGraphs: Graph[],
  previousCovers: Cover[]
): Cover[] {
  if (previousCovers.length === 0) {
    return getAllMinimumCovers(targetGraph, sourceGraphs);
  }
  let allCovers: Cover[] = [];
  const sourceGraphsWithIndex = sourceGraphs.map((graph, index) => ({
    index,
    ...graph,
  }));
  for (let i = 0; i < previousCovers.length; i++) {
    const curCover = previousCovers[i];
    const depth = curCover.length;
    const backtrack = function (depth: number) {
      if (
        isValidCover(
          targetGraph,
          curCover.map((cIndex) => sourceGraphsWithIndex[cIndex])
        )
      ) {
        allCovers = processRedundantCover(curCover, allCovers);
        return;
      }
      if (depth >= sourceGraphsWithIndex.length) {
        return;
      }
      for (const sourceGraph of sourceGraphsWithIndex) {
        if (curCover.some((cIndex) => cIndex === sourceGraph.index)) {
          continue;
        }
        curCover.push(sourceGraph.index);
        backtrack(depth + 1);
        curCover.pop();
      }
    };
    backtrack(depth);
  }
  return allCovers;
}

function createGraph(g: NodesGroup): Graph {
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];

  const keys = Object.keys(g);

  for (let i = 0; i < keys.length; i++) {
    const dimension = keys[i];
    const values = g[dimension];
    for (const value of values) {
      vertices.push(`${dimension}:${value}`);
      // 对于i之后的每一个维度，每个维值都要添加一条边
      for (let j = i + 1; j < keys.length; j++) {
        const nextDimension = keys[j];
        const nextValues = g[nextDimension];
        for (const nextValue of nextValues) {
          edges.push([
            `${dimension}:${value}`,
            `${nextDimension}:${nextValue}`,
          ]);
        }
      }
    }
  }

  return new Graph(vertices, edges);
}

// const allValidCovers = getAllValidCovers(targetGraph, recordGraphs);
// console.log(allValidCovers);
export { Graph, NodesGroup, FilterIterator, isValidCover, createGraph };
