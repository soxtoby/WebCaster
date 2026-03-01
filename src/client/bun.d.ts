declare module "*.svg" {
    const path: string;
    export default path;
}

declare namespace React {
    interface ButtonHTMLAttributes<T> {
        command?: string
        commandFor?: string
    }
    interface DialogHTMLAttributes<T> {
        onToggle?: (event: ToggleEvent<T>) => void
    }
    interface ToggleEvent<T = Element> extends SyntheticEvent<T> {
        newState: 'open' | 'closed'
        oldState: 'open' | 'closed'
    }
}