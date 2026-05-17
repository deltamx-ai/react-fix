export type SearchRecord = Record<string, unknown>
export type SensitiveState = Record<string, unknown>

export interface NavigateFn {
  (options: {
    to: string
    from?: string
    search?: SearchRecord
    replace?: boolean
    state?: SensitiveState
  }): void
}

export interface NavigateWithSensitiveStateOptions {
  navigate: NavigateFn
  to: string
  from?: string
  search?: SearchRecord
  replace?: boolean
  sensitive?: SensitiveState
}

export interface RouterLocationLike {
  pathname: string
  search?: SearchRecord
  state?: SensitiveState
}
