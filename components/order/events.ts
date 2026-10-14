// Menu cards ask the order form to add a flavour ("Add to order").
export const ADD_FLAVOUR_EVENT = "kdpops:add-flavour";

export function requestAddFlavour(productId: string) {
  window.dispatchEvent(new CustomEvent(ADD_FLAVOUR_EVENT, { detail: productId }));
}
