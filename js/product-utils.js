export const CATEGORIES = {
  kitchenware: "Kitchenware",
  furniture: "Furniture",
  homedecor: "Home Decor",
};

export function millis(item) {
  return item.createdAt && item.createdAt.toMillis
    ? item.createdAt.toMillis()
    : 0;
}

export function inProducts(item) {
  if (item.showInProducts === undefined && item.showInGallery === undefined) {
    return true;
  }
  return item.showInProducts === true;
}

export function inGallery(item) {
  return item.showInGallery === true;
}

export function sortItems(a, b) {
  const orderA = typeof a.order === "number";
  const orderB = typeof b.order === "number";
  return (
    Number(!!b.bestSeller) - Number(!!a.bestSeller) ||
    Number(orderB) - Number(orderA) ||
    (orderA && orderB ? a.order - b.order : 0) ||
    millis(b) - millis(a)
  );
}
