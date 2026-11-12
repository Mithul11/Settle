"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Title = { title: string; sub?: string };
const Ctx = createContext<{ value: Title; set: (t: Title) => void }>({
  value: { title: "" },
  set: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [value, set] = useState<Title>({ title: "" });
  return <Ctx.Provider value={{ value, set }}>{children}</Ctx.Provider>;
}

export function usePageTitle() {
  return useContext(Ctx).value;
}

/** Sets the top bar title and subtitle for the current page. */
export function PageTitle({ title, sub }: Title) {
  const { set } = useContext(Ctx);
  useEffect(() => {
    set({ title, sub });
  }, [set, title, sub]);
  return null;
}
