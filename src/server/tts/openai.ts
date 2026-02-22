import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"

export let openAiDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1'
}

export async function listOpenAiVoices(settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    return [
        { name: 'Alloy', providerVoiceId: 'alloy', id: 'openai:alloy', description: "Neutral and balanced.", gender: 'unknown', provider: 'openai' },
        { name: 'Ash', providerVoiceId: 'ash', id: 'openai:ash', description: "Soft-spoken, calm, and gentle.", gender: 'male', provider: 'openai' },
        { name: 'Ballad', providerVoiceId: 'ballad', id: 'openai:ballad', description: "Melodic, warm, and storyteller-like.", gender: 'male', provider: 'openai' },
        { name: 'Coral', providerVoiceId: 'coral', id: 'openai:coral', description: "Engaging, expressive, and dynamic", gender: 'female', provider: 'openai' },
        { name: 'Echo', providerVoiceId: 'echo', id: 'openai:echo', description: "Deep, warm, and resonant.", gender: 'male', provider: 'openai' },
        { name: 'Fable', providerVoiceId: 'fable', id: 'openai:fable', description: "British, narrative, and expressive.", gender: 'male', provider: 'openai' },
        { name: 'Nova', providerVoiceId: 'nova', id: 'openai:nova', description: "Energetic, bright, and friendly.", gender: 'female', provider: 'openai' },
        { name: 'Onyx', providerVoiceId: 'onyx', id: 'openai:onyx', description: "Deep, authoritative, and professional.", gender: 'male', provider: 'openai' },
        { name: 'Sage', providerVoiceId: 'sage', id: 'openai:sage', description: "Measured, thoughtful, and composed.", gender: 'unknown', provider: 'openai' },
        { name: 'Shimmer', providerVoiceId: 'shimmer', id: 'openai:shimmer', description: "Warm, approachable, and clear.", gender: 'female', provider: 'openai' },
        { name: 'Verse', providerVoiceId: 'verse', id: 'openai:verse', description: "Poetic, rhythmic, and artistic.", gender: 'female', provider: 'openai' },
        { name: 'Marin', providerVoiceId: 'marin', id: 'openai:marin', description: "Natural, conversational, smooth and modern.", gender: 'female', provider: 'openai' },
        { name: 'Cedar', providerVoiceId: 'cedar', id: 'openai:cedar', description: "Calm, grounded, steady and reassuring.", gender: 'male', provider: 'openai' },
    ]
}