// Engines that ship migrations. A new engine adds its name here, its entry in tablesByEngine and its folder next to sqlite/ and pg/.
export const ENGINES = ['sqlite', 'pg'] as const;
export type Engine = (typeof ENGINES)[number];
