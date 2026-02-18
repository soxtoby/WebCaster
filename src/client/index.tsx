import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { FeedManagerPage } from "./feeds/feed-manager-page"
import { queryClient } from "./feeds/feed-collections"
import { updateStylesheet } from "stylemap"

updateStylesheet()

createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
        <FeedManagerPage />
    </QueryClientProvider>
)