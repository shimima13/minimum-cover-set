import { def } from '@vue/shared';
import { union, intersect, complement } from './set';

const recordData = [
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
const filterState = {
  country: {
    all: union(...recordData.map((r) => r.country)),
    selected: new Set(),
    disabled: new Set(),
  },
  niceclass: {
    all: union(...recordData.map((r) => r.niceclass)),
    selected: new Set(),
    disabled: new Set(),
  },
};
const allRecords = recordData.map((r, i) => i);
let globalPlans = [];
let globalUnavailables = [];
export function findCoveringSets({
  plans, // 记录当前已选方案，方案的记录是必选项
  unavailables, // 和所有方案都没关系的，记为不可选。
  targetDimension, // 本次操作添加维度  'country'|'niceclass'
  //   targetSubset, // 本次操作添加维度的值的集合 例如['FR', 'US']，单次只会有一个元素
  targetValue,
}) {
  //   currentRecordIndexArray,
  //   dimension,
  //   targetSubset
  // 本次可选的记录， 是所有记录除去不可选的记录
  //   const availableRecords = Array.from(complement(unavailables, allRecords));
  //   const resultPlans = plans;
  //   const planPath = [];
  //   targetSubset.forEach((dim) => filterState[targetDimension].selected.add(dim));
  //   function backtrack(startIndex, tempDimensionValueSet) {
  //     if (tempDimensionValueSet.size === targetSubset.size) {
  //       resultPlans.push(Array.from(planPath));
  //       return;
  //     }
  //     // 遍历所有可选项
  //     for (let i = startIndex; i < availableRecords.length; i++) {
  //       const record = recordData[availableRecords[i]];
  //       const partialIntersectionSet = new Set(
  //         [...targetSubset].filter((dim) => !tempDimensionValueSet.has(dim))
  //       );
  //       // 如果允许重复，这里partialIntersectionSet直接替换成targetSubset
  //       const intersection = new Set(
  //         [...partialIntersectionSet].filter((dim) =>
  //           record[targetDimension].includes(dim)
  //         )
  //       );

  //       if (intersection.size === 0) continue;

  //       for (const dim of intersection) {
  //         tempDimensionValueSet.add(dim);
  //         planPath.push(availableRecords[i]);
  //         backtrack(i + 1, tempDimensionValueSet);
  //         planPath.pop();
  //         tempDimensionValueSet.delete(dim);
  //       }
  //     }
  //   }

  //   backtrack(0, new Set());
  const availableRecords = Array.from(complement(unavailables, allRecords));
  filterState[targetDimension].selected.add(targetValue);
  let resultPlans = [];
  let planPath = [];
  if (plans.length === 0) {
    availableRecords.forEach((r) => {
      if (recordData[r][targetDimension].includes(targetValue)) {
        resultPlans.push([r]);
      }
    });
  } else {
    plans.forEach((innerPlan) => {
      // 首先，如果当前维值已经在plan中了，这个plan不用扩展了，直接加入最终方案
      if (
        innerPlan.some((r) =>
          recordData[r][targetDimension].includes(targetValue)
        )
      ) {
        resultPlans.push(innerPlan);
      } else {
        const restRecords = complement(innerPlan, availableRecords);
        restRecords.forEach((r) => {
          if (recordData[r][targetDimension].includes(targetValue)) {
            // 满足新增维度有这个值还不行，另一个维度也必须是选中维度之一
            if (
              filterState[getAffectedDimension(targetDimension)].selected
                .size === 0 ||
              recordData[r][getAffectedDimension(targetDimension)].some((dim) =>
                filterState[getAffectedDimension(targetDimension)].selected.has(
                  dim
                )
              )
            ) {
              resultPlans.push([...innerPlan, r]);
            }
            // resultPlans.push([...innerPlan, r]);
          }
        });
      }
    });
  }
  resultPlans.sort((a, b) => a.length - b.length);
  resultPlans = removeRedundantPlans(resultPlans);
  return resultPlans;
}

// O(n^2)
function removeRedundantPlans(plans) {
  // 从最小的维值集合开始，如果有包含关系，就删除，递归
  // plans.sort((a, b) => a.length - b.length);
  const firstPlan = plans[0];
  if (plans.length <= 1) return plans;
  const resultPlans = [];
  for (let i = 1; i < plans.length; i++) {
    if (firstPlan.every((r) => plans[i].includes(r))) {
      continue;
    } else {
      resultPlans.push(plans[i]);
    }
  }
  return [firstPlan, ...removeRedundantPlans(resultPlans)];
}
function findDisabledValues() {
  const dimensions = ['country', 'niceclass'];
  // 可选的选项
  const optionalDimensionValues = {
    country: complement(filterState.country.disabled, filterState.country.all),
    niceclass: complement(
      filterState.niceclass.disabled,
      filterState.niceclass.all
    ),
  };
  dimensions.forEach((dim) => {
    // 去掉已选上的选项
    const toBeTestDimValues = complement(
      filterState[dim].selected,
      optionalDimensionValues[dim]
    );
    const affectedDimension = getAffectedDimension(dim);
    const affectedDimensionHasSelectedVal =
      filterState[affectedDimension].selected.size === 0;
    toBeTestDimValues.forEach((dimVal) => {
      // 如果另一个维度没选，那么这个当前检测的维值dimVal需要保证另一个维度存在一个可选维值与自己（dimVal）组成的组合在任一非不可选记录即可 （或）
      if (affectedDimensionHasSelectedVal) {
        let dimValDisabled = true;
        recordData.forEach((r, rIndex) => {
          if (globalUnavailables.includes(rIndex)) return;
          if (r[dim].includes(dimVal)) {
            const optionalDimensionValues = complement(
              filterState[affectedDimension].disabled,
              filterState[affectedDimension].all
            );
            const hasIntersection =
              intersect(
                // 可选的维值
                optionalDimensionValues,
                // 当前记录的维值
                r[affectedDimension]
              ).size > 0;
            if (hasIntersection) {
              dimValDisabled = false;
            }
          }
        });
        if (dimValDisabled) {
          filterState[dim].disabled.add(dimVal);
        }

        // 否则，dimVal需要保证dimVal和所有已选的另一个维度的维值组合都（都！）在在任一非不可选记录中 （与）
      } else {
        let dimValDisabled = false;
        filterState[affectedDimension].selected.forEach((selectedVal) => {
          const hasValidCombo = recordData.some((r, rIndex) => {
            if (globalUnavailables.includes(rIndex)) return false;
            return (
              r[dim].includes(dimVal) &&
              r[affectedDimension].includes(selectedVal)
            );
          });
          if (!hasValidCombo) {
            dimValDisabled = true;
            return;
          }
        });
        if (dimValDisabled) {
          filterState[dim].disabled.add(dimVal);
        }
      }

      //   let dimValDisabled = true;
      //   recordData.forEach((r, rIndex) => {
      //     if (globalUnavailables.includes(rIndex)) return;
      //     if (r[dim].includes(dimVal)) {
      //       // 这里计算的是另一个维度，这条记录另一个维度是不是在已选值里
      //       const selectedAffectedDimensionSet =
      //         filterState[affectedDimension].selected.size === 0
      //           ? complement(
      //               filterState[affectedDimension].disabled,
      //               filterState[affectedDimension].all
      //             )
      //           : filterState[affectedDimension].selected;
      //       const hasIntersection =
      //         intersect(
      //           // 可选的维值
      //           selectedAffectedDimensionSet,
      //           // 当前记录的维值
      //           r[affectedDimension]
      //         ).size > 0;
      //       if (hasIntersection) {
      //         dimValDisabled = false;
      //       }
      //     }
      //   });
      //   if (dimValDisabled) {
      //     filterState[dim].disabled.add(dimVal);
      //   }
    });
  });
}

function onlyOptionalValue() {
  const optionalCountrySet = complement(
    filterState.country.disabled,
    filterState.country.all
  );
  const selectableCountrySet = complement(
    filterState.country.selected,
    optionalCountrySet
  );
  const optionalNiceclassSet = complement(
    filterState.niceclass.disabled,
    filterState.niceclass.all
  );
  const selectableNiceclassSet = complement(
    filterState.niceclass.selected,
    optionalNiceclassSet
  );
  if (selectableCountrySet.size === 1) {
    return {
      value: Array.from(selectableCountrySet)[0],
      dimension: 'country',
    };
  } else if (selectableNiceclassSet.size === 1) {
    return {
      value: Array.from(selectableNiceclassSet)[0],
      dimension: 'niceclass',
    };
  } else {
    return undefined;
  }
}

function findUnavailables(plans, affectedDimension) {
  const unavailables = [];
  const unionRecordsOfPlans = union(...plans);
  const unionRecordsOfPlansArray = Array.from(unionRecordsOfPlans);

  recordData.forEach((r, rIndex) => {
    // 首先，不能在必选的范围内
    if (!unionRecordsOfPlans.has(rIndex)) {
      const { country, niceclass } = r;

      let hasIntersection = false;
      // 检测当前记录的affectedDimension的维值，与affectedDimensionValueAvailable是否有交集
      //   const recordIntersection = intersect(
      //     affectedDimensionValueAvailable,
      //     r[affectedDimension]
      //   );
      // 改为两维度都没有可选值时，才加入unavailables
      //   const optionalCountrySet = complement(
      //     filterState.country.disabled,
      //     filterState.country.all
      //   );
      //   const hasSameCountry = country.some((dim) => optionalCountrySet.has(dim));

      //   const optionalNiceclassSet = complement(
      //     filterState.niceclass.disabled,
      //     filterState.niceclass.all
      //   );
      //   const hasSameNiceclass = niceclass.some((dim) =>
      //     optionalNiceclassSet.has(dim)
      //   );

      //   const optionalCountrySet =
      //     filterState.country.selected.size === 0
      //       ? complement(filterState.country.disabled, filterState.country.all)
      //       : filterState.country.selected;
      //   const hasSameCountry = country.some((dim) => optionalCountrySet.has(dim));
      //   const optionalNiceclassSet =
      //     filterState.niceclass.selected.size === 0
      //       ? complement(
      //           filterState.niceclass.disabled,
      //           filterState.niceclass.all
      //         )
      //       : filterState.niceclass.selected;
      //   const hasSameNiceclass = niceclass.some((dim) =>
      //     optionalNiceclassSet.has(dim)
      //   );

      //   hasIntersection = hasSameCountry || hasSameNiceclass;
      //   if (!hasIntersection) {
      //     unavailables.push(rIndex);
      //   }
      let recordIsValid = true;
      const everyCountryInvalid = country.every((dimVal) =>
        filterState.country.disabled.has(dimVal)
      );
      const everyNiceclassInvalid = niceclass.every((dimVal) =>
        filterState.niceclass.disabled.has(dimVal)
      );
      if (everyCountryInvalid || everyNiceclassInvalid) {
        recordIsValid = false;
      }
      if (!recordIsValid) {
        unavailables.push(rIndex);
      }
    }
  });
  return unavailables;
}

function getAffectedDimension(targetDimension) {
  const affectedDimension =
    targetDimension === 'country' ? 'niceclass' : 'country';
  return affectedDimension;
}

function stepOver(targetValue, targetDimension) {
  if (filterState[targetDimension].disabled.has(targetValue)) {
    throw new Error('targetValue is disabled');
  }
  globalPlans = findCoveringSets({
    plans: globalPlans,
    unavailables: globalUnavailables,
    targetDimension,
    targetValue,
  });

  const affectedDimension = getAffectedDimension(targetDimension);
  findDisabledValues();
  globalUnavailables = findUnavailables(globalPlans, affectedDimension);
  const onlyOpt = onlyOptionalValue();
  //   if (onlyOpt) {
  //     const { value, dimension } = onlyOpt;
  //     stepOver(value, dimension);
  //   }
}
function display() {
  console.log('plans:', globalPlans);
  console.log('unavailables:', globalUnavailables);
  console.log('filterState:');
  console.log('--country:');
  console.log('----selected:', filterState.country.selected);
  console.log('----disabled:', filterState.country.disabled);
  console.log('--niceclass:');
  console.log('----selected:', filterState.niceclass.selected);
  console.log('----disabled:', filterState.niceclass.disabled);
}
function clear() {
  globalPlans = [];
  globalUnavailables = [];
  filterState.country.selected.clear();
  filterState.niceclass.selected.clear();
  filterState.country.disabled.clear();
  filterState.niceclass.disabled.clear();
}

function testCaseNumber(num) {
  console.log('------------------------');
  console.log(`---------Case ${num}---------`);
  console.log('------------------------');
  switch (num) {
    case 1:
      stepOver('FR', 'country');
      display();
      clear();
      break;
    case 2:
      stepOver('FR', 'country');
      stepOver('US', 'country');
      display();
      clear();
      break;
    case 3:
      stepOver('FR', 'country');
      stepOver('3', 'niceclass');
      display();
      clear();
      break;
    case 4:
      stepOver('GB', 'country');
      display();
      clear();
      break;
    case 5:
      stepOver('GB', 'country');
      stepOver('3', 'niceclass');
      display();
      clear();
      break;
    case 6:
      stepOver('GB', 'country');
      stepOver('DE', 'country');
      display();
      clear();
      break;
    case 7:
      stepOver('GB', 'country');
      stepOver('DE', 'country');
      stepOver('US', 'country');
      display();
      clear();
      break;
    case 8:
      stepOver('GB', 'country');
      stepOver('DE', 'country');
      stepOver('US', 'country');
      stepOver('FR', 'country');
      display();
      clear();
      break;
    default:
      break;
  }
}

export function test(testArr) {
  if (typeof testArr === 'undefined') {
    for (let i = 1; i <= 8; i++) {
      testCaseNumber(i);
    }
  }
  if (typeof testArr === 'array') {
    testArr.forEach((num) => {
      testCaseNumber(num);
    });
  }
  if (typeof testArr === 'number') {
    testCaseNumber(testArr);
  }
}
