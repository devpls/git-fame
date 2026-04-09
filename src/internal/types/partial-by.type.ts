/**
 * Makes the specified keys of `T` optional while leaving all other keys
 * required. The inverse of `RequiredBy`.
 *
 * @example
 * interface User { id: number; name: string; email: string }
 * type DraftUser = PartialBy<User, 'id'>;
 * // { id?: number; name: string; email: string }
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
