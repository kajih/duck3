export interface SeedMeme {
  id: string;
  /** Caption shown on the card and used as accessible text. */
  caption: string;
  /** File name in backend/assets/memes. */
  file: string;
}

export const seedMemes: SeedMeme[] = [
  { id: "works-on-my-machine", caption: "It works on my machine", file: "works-on-my-machine.svg" },
  {
    id: "friday-deploy",
    caption: "Deploying on a Friday afternoon. What could go wrong?",
    file: "friday-deploy.svg",
  },
  {
    id: "off-by-one",
    caption: "There are two hard problems: naming things, cache invalidation and off-by-one errors",
    file: "off-by-one.svg",
  },
  {
    id: "console-log",
    caption: "Debugging with console.log: a time-honoured tradition",
    file: "console-log.svg",
  },
  { id: "no-tests", caption: "No tests, no bugs", file: "no-tests.svg" },
  { id: "temporary-fix", caption: "Nothing is as permanent as a temporary fix", file: "temporary-fix.svg" },
  { id: "merge-conflict", caption: "Merge conflict in a 4000 line file", file: "merge-conflict.svg" },
  { id: "semicolon", caption: "Three hours of debugging. One missing semicolon.", file: "semicolon.svg" },
  { id: "readme", caption: "I will document it later", file: "readme.svg" },
  { id: "rm-rf", caption: "rm -rf node_modules: the universal fix", file: "rm-rf.svg" },
  { id: "it-was-dns", caption: "It's always DNS", file: "it-was-dns.svg" },
  { id: "production-is-down", caption: "Who touched production?", file: "production-is-down.svg" },
  { id: "git-force-push", caption: "git push --force: living on the edge", file: "git-force-push.svg" },
  { id: "stack-overflow", caption: "Copy from Stack Overflow, paste, pray", file: "stack-overflow.svg" },
  { id: "legacy-code", caption: "Don't touch it. Nobody knows why it works.", file: "legacy-code.svg" },
  { id: "infinite-loop", caption: "while (true) { it's fine }", file: "infinite-loop.svg" },
  { id: "null-pointer", caption: "Cannot read properties of undefined", file: "null-pointer.svg" },
  { id: "it-depends", caption: "Senior developer answer: it depends", file: "it-depends.svg" },
  { id: "css-center", caption: "Centering a div: a journey", file: "css-center.svg" },
  { id: "estimate", caption: "It will take two days. (Two weeks later)", file: "estimate.svg" },
  { id: "standup", caption: "This meeting could have been an email", file: "standup.svg" },
  { id: "dark-mode", caption: "Light mode: the real production incident", file: "dark-mode.svg" },
  { id: "tabs-vs-spaces", caption: "Tabs or spaces? Let the war begin", file: "tabs-vs-spaces.svg" },
  { id: "works-in-prod", caption: "Works in staging. Burns in production.", file: "works-in-prod.svg" },
  { id: "todo", caption: "// TODO: fix later (2017)", file: "todo.svg" },
  { id: "node-modules", caption: "node_modules: heavier than a black hole", file: "node-modules.svg" },
  { id: "ai-wrote-it", caption: "The AI wrote it. I do not know how it works.", file: "ai-wrote-it.svg" },
  { id: "pr-lgtm", caption: "1000 lines changed. LGTM.", file: "pr-lgtm.svg" },
  { id: "cache", caption: "Have you tried clearing the cache?", file: "cache.svg" },
  { id: "backup", caption: "Nobody tests backups until the day they need one", file: "backup.svg" },
];
