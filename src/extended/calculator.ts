export const calculate = (
  operation: string,
  values: number[],
  weights: number[] = []
): number | undefined => {
  if (!values.length) {
    return 0;
  }
  switch (operation) {
    case "sum": {
      return values.reduce((sum, value) => sum + value, 0);
    }
    case "product": {
      return values.reduce((product, value) => product * value, 1);
    }
    case "min": {
      return Math.min(...values);
    }
    case "max": {
      return Math.max(...values);
    }
    case "weighted": {
      return values.reduce(
        (sum, value, i) => sum + value * (weights[i] ?? 1),
        0
      );
    }
    case "ratio": {
      return values.length === 2 && values[1] !== 0
        ? (values[0] ?? 0) / (values[1] ?? 1)
        : undefined;
    }
    default: {
      throw new Error(`Unsupported calculator operation: ${operation}`);
    }
  }
};
