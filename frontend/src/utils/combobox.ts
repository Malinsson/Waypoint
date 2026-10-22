// The id of one row in a suggestion list. Shared by the list, which sets
// it, and the input, which points at the highlighted row with
// aria-activedescendant, so the two can never disagree.
export function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`
}
