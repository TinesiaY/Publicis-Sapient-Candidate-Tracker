// Classes for text inputs and selects. They live outside the component files, so the component files export only components.

export function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 ${
    hasError
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
      : "border-line focus:border-brand focus:ring-brand/20"
  }`
}
