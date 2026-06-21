import { defaultImageDescriptionProviderSettings } from "../../../shared/image-description-defaults"

export let imageDescriptionProviderDefaults = {
    openai: {
        label: 'OpenAI',
        ...defaultImageDescriptionProviderSettings.openai
    },
    gemini: {
        label: 'Google Gemini',
        ...defaultImageDescriptionProviderSettings.gemini
    }
} as const

export let ttsProviderMetadata = {
    elevenlabs: {
        label: 'ElevenLabs',
        requiresApiKey: true
    },
    inworld: {
        label: 'Inworld',
        requiresApiKey: true
    },
    lemonfox: {
        label: 'Lemonfox',
        requiresApiKey: true
    },
    openai: {
        label: 'OpenAI',
        requiresApiKey: true
    },
    voicebox: {
        label: 'Voicebox',
        requiresApiKey: false
    }
} as const
