if (process.argv.includes('--update')) {
    let { updateApp } = await import("./updater")
    await updateApp()
} else {
    if (!process.argv.includes('--background')) {
        let { launchDetachedFromOwnWindowsConsole } = await import("./windows-console")

        if (launchDetachedFromOwnWindowsConsole())
            process.exit(0)
    }

    let { startApp } = await import("./app")
    await startApp()
}
