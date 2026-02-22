import type { TtsProviderSettings, VoiceRecord } from "../settings/settings-types"

export let lemonFoxDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.lemonfox.ai/v1'
}

export async function listLemonFoxVoices(settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    return [
        { name: 'Heart', providerVoiceId: 'heart', id: 'lemonfox:heart', description: "Clear, friendly, and professional female voice with a standard American accent.", gender: 'female', provider: 'lemonfox' },
        { name: 'Bella', providerVoiceId: 'bella', id: 'lemonfox:bella', description: "Clear, youthful female voice with a composed and melodic American accent.", gender: 'female', provider: 'lemonfox' },
        { name: 'Michael', providerVoiceId: 'michael', id: 'lemonfox:michael', description: "A steady, calm male voice frequently chosen for e-learning and instructional videos.", gender: 'male', provider: 'lemonfox' },
        { name: 'Alloy', providerVoiceId: 'alloy', id: 'lemonfox:alloy', description: "Neutral and balanced.", gender: 'female', provider: 'lemonfox' },
        { name: 'Aoede', providerVoiceId: 'aoede', id: 'lemonfox:aoede', description: "Soft, breathy female voice with a gentle, slightly high-pitched and melodic quality.", gender: 'female', provider: 'lemonfox' },
        { name: 'Kore', providerVoiceId: 'kore', id: 'lemonfox:kore', description: "A deep, resonant, and authoritative masculine voice with a formal and steady delivery.", gender: 'female', provider: 'lemonfox' },
        { name: 'Jessica', providerVoiceId: 'jessica', id: 'lemonfox:jessica', description: "A bright, energetic, and expressive female voice with a friendly, upbeat tone.", gender: 'female', provider: 'lemonfox' },
        { name: 'Nicole', providerVoiceId: 'nicole', id: 'lemonfox:nicole', description: "A soft, intimate, and breathy female voice delivered at a near-whisper pace.", gender: 'female', provider: 'lemonfox' },
        { name: 'Nova', providerVoiceId: 'nova', id: 'lemonfox:nova', description: "A professional yet approachable female voice with a balanced, contemporary American cadence.", gender: 'female', provider: 'lemonfox' },
        { name: 'River', providerVoiceId: 'river', id: 'lemonfox:river', description: "Bright, versatile, and clear non-binary voice with a friendly, neutral American accent.", gender: 'female', provider: 'lemonfox' },
        { name: 'Sarah', providerVoiceId: 'sarah', id: 'lemonfox:sarah', description: "A professional and clear female voice, often used for narrations and corporate presentations.", gender: 'female', provider: 'lemonfox' },
        { name: 'Sky', providerVoiceId: 'sky', id: 'lemonfox:sky', description: "High-pitched, youthful, and energetic female voice with a clear American delivery.", gender: 'female', provider: 'lemonfox' },
        { name: 'Echo', providerVoiceId: 'echo', id: 'lemonfox:echo', description: "Confident, steady, and slightly lower-pitched masculine voice with a neutral American accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Eric', providerVoiceId: 'eric', id: 'lemonfox:eric', description: "Bright, youthful, and energetic masculine voice with a friendly American accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Fenrir', providerVoiceId: 'fenrir', id: 'lemonfox:fenrir', description: "Deep, gravelly, and powerful masculine voice with a commanding American tone.", gender: 'male', provider: 'lemonfox' },
        { name: 'Liam', providerVoiceId: 'liam', id: 'lemonfox:liam', description: "Warm, resonant, and natural masculine voice with a relaxed American cadence.", gender: 'male', provider: 'lemonfox' },
        { name: 'Onyx', providerVoiceId: 'onyx', id: 'lemonfox:onyx', description: "Very deep, smooth, and slightly hushed masculine voice with a steady American accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Puck', providerVoiceId: 'puck', id: 'lemonfox:puck', description: "Light, youthful, and somewhat playful masculine voice with a standard American accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Adam', providerVoiceId: 'adam', id: 'lemonfox:adam', description: "Deep, resonant, and calm masculine voice with a neutral American accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Santa', providerVoiceId: 'santa', id: 'lemonfox:santa', description: "Jolly old man from the north pole who spends a lot of time in shopping malls.", gender: 'male', provider: 'lemonfox' },
        { name: 'Alice', providerVoiceId: 'alice', id: 'lemonfox:alice', description: "Clear, bright, and polished female voice with a standard British accent.", gender: 'female', provider: 'lemonfox' },
        { name: 'Emma', providerVoiceId: 'emma', id: 'lemonfox:emma', description: "Clear, expressive, and friendly female voice with a standard British accent.", gender: 'female', provider: 'lemonfox' },
        { name: 'Isabella', providerVoiceId: 'isabella', id: 'lemonfox:isabella', description: "Sophisticated, clear, and melodic female voice with a polished standard British accent.", gender: 'female', provider: 'lemonfox' },
        { name: 'Lily', providerVoiceId: 'lily', id: 'lemonfox:lily', description: "A soft, youthful female voice designed for storytelling or creative content.", gender: 'female', provider: 'lemonfox' },
        { name: 'Daniel', providerVoiceId: 'daniel', id: 'lemonfox:daniel', description: "Deep, mature, and authoritative masculine voice with a standard British accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Fable', providerVoiceId: 'fable', id: 'lemonfox:fable', description: "Friendly, clear, and slightly higher-pitched masculine voice with a standard British accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'George', providerVoiceId: 'george', id: 'lemonfox:george', description: "Mature, warm, and sophisticated masculine voice with a standard British accent.", gender: 'male', provider: 'lemonfox' },
        { name: 'Lewis', providerVoiceId: 'lewis', id: 'lemonfox:lewis', description: "Crisp, professional, and mid-range masculine voice with a standard British accent.", gender: 'male', provider: 'lemonfox' },
    ]
}