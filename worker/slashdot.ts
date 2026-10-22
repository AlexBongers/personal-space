import type { WorkspaceDatabase } from "./workspace-store.ts";
import { handleNewsApi, parseNewsFeed } from "./news.ts";
export type { NewsStory as SlashdotStory, NewsFeed as SlashdotFeed } from "./news.ts";
export const parseSlashdotFeed = (xml: string, fetchedAt?: string) => parseNewsFeed(xml, "slashdot", fetchedAt);
export const handleSlashdotApi = (request: Request, database?: WorkspaceDatabase) => handleNewsApi(request, "slashdot", database);
