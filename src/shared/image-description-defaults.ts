export let defaultImageDescriptionPrompt = 'Write an audio description script for this image, intended for listeners who cannot see it. Focus on visible details only.'

export let defaultImageDescriptionProviderSettings = {
    openai: {
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5-mini',
        prompt: defaultImageDescriptionPrompt
    },
    gemini: {
        apiKey: '',
        baseUrl: 'https://generativelanguage.googleapis.com',
        model: 'gemini-3.1-flash-lite-preview',
        prompt: defaultImageDescriptionPrompt
    }
} as const