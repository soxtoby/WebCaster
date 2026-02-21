import { router } from "../trpc/trpc";
import { list } from "./voices";

export const tts = router({
    voices: {
        list
    }
});