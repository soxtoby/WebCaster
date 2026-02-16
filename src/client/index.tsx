import { createRoot } from "react-dom/client"
import { FeedManagerPage } from "./feeds/feed-manager-page"
import { updateStylesheet } from "stylemap"

updateStylesheet()

createRoot(document.getElementById("root")!).render(<FeedManagerPage />)