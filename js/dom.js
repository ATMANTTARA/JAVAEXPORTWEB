export function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : value);
  });
  kids.forEach((kid) => {
    if (kid) node.append(kid);
  });
  return node;
}
