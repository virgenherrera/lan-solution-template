// Engines that ship migrations. A new engine adds its name here, its entry in tablesByEngine and its folder next to sqlite/.
export const ENGINES = ['sqlite'] as const;
export type Engine = (typeof ENGINES)[number];
