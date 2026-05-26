import { createContext, useContext } from 'react'

export const ToggleContext = createContext(null)

export function useToggle() {
  return useContext(ToggleContext)
}
