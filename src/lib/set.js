export const union = function (...sets) {
  const unionSet = new Set();
  sets.forEach((set) => {
    set.forEach((item) => unionSet.add(item));
  });
  return unionSet;
};

export const intersect = function (...sets) {
  const intersectionSet = new Set([...sets[0]]);
  sets.forEach((set) => {
    // set.forEach((item) => {
    //   if (!intersectionSet.has(item)) {
    //     intersectionSet.delete(item);
    //   }
    // });
    const innerSet = new Set([...set]);
    intersectionSet.forEach((item) => {
      if (!innerSet.has(item)) {
        intersectionSet.delete(item);
      }
    });
  });
  return intersectionSet;
};

// 计算集合A在全集U中的补集
export const complement = function (A, U) {
  const complementSet = new Set();
  const ASet = new Set(A);
  const USet = new Set(U);
  for (const value of USet) {
    if (!ASet.has(value)) {
      complementSet.add(value);
    }
  }
  return complementSet;
};
